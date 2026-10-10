// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test, console2} from "forge-std/Test.sol";
import {BandReserve} from "../../src/markets/BandReserve.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {RidesBase} from "./RidesBase.t.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

/// @dev Drives rides through every path over a random-walk BTC price with gaps. Expected refusals are swallowed;
///      panics (overflow, underflow, division by zero) are counted — the D-182 lesson: an invariant run that reverts
///      silently hides the bug.
contract RideHandler is Test {
    uint256 internal constant OWNER_PK = 0xA11CE;
    bytes32 internal constant FEED = keccak256("BTC/USD");
    int32 internal constant EXPO = -8;
    uint64 internal constant CONF = 1e8;
    uint256 internal constant MAX_STEP_BPS = 80;
    uint256 internal constant GAP_EVERY = 13;
    uint256 internal constant GAP_BPS = 400;
    /// @dev One open in this many is left unfilled, so the expiry path runs too.
    uint256 internal constant LAPSE_EVERY = 9;
    uint256 internal constant FULL_EVERY = 3;
    uint256 internal constant SHOCK_BPS = 2600;
    bytes4 internal constant PANIC = 0x4e487b71;

    BandReserve internal reserve;
    MockPyth internal pyth;
    address internal verifier;
    address internal owner;
    int64 public price = 60_000e8;
    uint256 public panics;
    uint256 public overpaid;
    uint256 internal nonce = 1 << 128;
    uint256 internal steps;
    uint256[] public ids;

    constructor(BandReserve reserve_, MockPyth pyth_, address verifier_) {
        reserve = reserve_;
        pyth = pyth_;
        verifier = verifier_;
        owner = vm.addr(OWNER_PK);
    }

    receive() external payable {}

    // ------------------------------------------------------------------------------------------------ actions

    function open(bool isLong, uint256 marginSeed, uint256 levSeed) external {
        _tick(marginSeed);
        uint64 margin = uint64(bound(marginSeed, 1e6, 50e6));
        uint32 lev = uint32(bound(levSeed, MIN_LEVERAGE_BPS, 400_000));
        RideIntent memory it = _intent(ACTION_OPEN, isLong, 0, margin, lev, 0, isLong ? type(int64).max : int64(1));
        try reserve.commitRide(it, _sign(it), _noPermit()) returns (uint256 id) {
            ids.push(id);
            // Like the relay: the commit fills at its print (unless this one is left to lapse).
            if (levSeed % LAPSE_EVERY != 0) _fill(id);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    function fill(uint256 idSeed) external {
        _tick(idSeed);
        (uint256 id, bool ok) = _pick(idSeed);
        if (ok) _fill(id);
    }

    function _fill(uint256 id) internal {
        Ride memory r = reserve.rideOf(id);
        if (r.status != RIDE_COMMITTED && r.closing == 0) return;
        if (vm.getBlockTimestamp() <= r.target) vm.warp(r.target + 1);
        uint256[] memory one = new uint256[](1);
        one[0] = id;
        (bytes memory proof, uint256 fee) = _proofAt(r.target);
        uint256 before = _owed(r);
        try reserve.finalizeRides{value: fee}(r.target, one, proof) {
            _checkPaid(id, r, before);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    function close(uint256 idSeed, uint256 fraction) external {
        _tick(idSeed);
        (uint256 id, bool ok) = _pick(idSeed);
        if (!ok) return;
        Ride memory r = reserve.rideOf(id);
        if (r.status != RIDE_OPEN || r.closing != 0) return;
        if (vm.getBlockTimestamp() < r.filledAt + MIN_HOLD_SEC) vm.warp(r.filledAt + MIN_HOLD_SEC);
        // Every third close is the whole ride; the rest a random part of it.
        uint128 size = fraction % FULL_EVERY == 0 ? 0 : uint128(bound(fraction, 1, r.size));
        RideIntent memory it = _intent(ACTION_CLOSE, r.isLong, id, 0, 0, size, r.isLong ? int64(1) : type(int64).max);
        try reserve.commitRide(it, _sign(it), _noPermit()) {
            _tickPrice(fraction);
            _fill(id);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    /// @dev Proves a recent print (within admission) against a ride's bounds.
    function prove(uint256 idSeed, uint256 backSeed) external {
        _tick(idSeed);
        (uint256 id, bool ok) = _pick(idSeed);
        if (!ok) return;
        Ride memory r = reserve.rideOf(id);
        if (r.status != RIDE_OPEN) return;
        uint40 t = uint40(vm.getBlockTimestamp()) - uint40(bound(backSeed, 0, 30));
        if (t < r.updatedAt) t = r.updatedAt;
        (bytes memory proof, uint256 fee) = _proofAt(t);
        uint256[] memory one = new uint256[](1);
        one[0] = id;
        uint256 before = _owed(r);
        try reserve.settleBounds{value: fee}(t, one, proof) {
            _checkPaid(id, r, before);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    /// @dev A one-print shock past any ride's cap or knock-out, then a bound proof at it.
    function shock(bool up, uint256 idSeed) external {
        vm.warp(vm.getBlockTimestamp() + 1);
        int256 next = int256(price) * int256(up ? BPS + SHOCK_BPS : BPS - SHOCK_BPS) / int256(BPS);
        price = int64(next);
        this.prove(idSeed, 0);
    }

    function end(uint256 idSeed) external {
        (uint256 id, bool ok) = _pick(idSeed);
        if (!ok) return;
        Ride memory r = reserve.rideOf(id);
        if (r.status != RIDE_OPEN) return;
        uint40 at = r.filledAt + reserve.rideMarketOf(0).maxLifeSec;
        if (vm.getBlockTimestamp() <= at) vm.warp(at + 1);
        (bytes memory proof, uint256 fee) = _proofAt(at);
        uint256[] memory one = new uint256[](1);
        one[0] = id;
        uint256 before = _owed(r);
        try reserve.settleEnds{value: fee}(at, one, proof) {
            _checkPaid(id, r, before);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    function expire(uint256 idSeed) external {
        (uint256 id, bool ok) = _pick(idSeed);
        if (!ok) return;
        vm.warp(vm.getBlockTimestamp() + 301);
        uint256[] memory one = new uint256[](1);
        one[0] = id;
        try reserve.expireRides(one) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    function refresh(bool isLong) external {
        uint8 side = isLong ? SIDE_LONG : SIDE_SHORT;
        uint256 n;
        for (uint256 i; i < ids.length; ++i) {
            Ride memory r = reserve.rideOf(ids[i]);
            if (r.status == RIDE_OPEN && r.isLong == isLong) ++n;
        }
        uint256[] memory open_ = new uint256[](n);
        n = 0;
        for (uint256 i; i < ids.length; ++i) {
            Ride memory r = reserve.rideOf(ids[i]);
            if (r.status == RIDE_OPEN && r.isLong == isLong) open_[n++] = ids[i];
        }
        try reserve.refreshFrontier(0, side, open_) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    // ------------------------------------------------------------------------------------------------ views

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    // ------------------------------------------------------------------------------------------------ helpers

    /// @dev Time moves 1–20 s and the price walks; every 13th step gaps. (`vm.getBlockTimestamp`: via-IR caches
    ///      `block.timestamp` across a warp.)
    function _tick(uint256 seed) internal {
        vm.warp(vm.getBlockTimestamp() + 1 + seed % 20);
        _tickPrice(seed);
    }

    function _tickPrice(uint256 seed) internal {
        uint256 stepBps = ++steps % GAP_EVERY == 0 ? GAP_BPS : MAX_STEP_BPS;
        int256 move =
            int256(price) * int256(seed % (2 * stepBps + 1)) / 10_000 - int256(price) * int256(stepBps) / 10_000;
        int256 next = int256(price) + move;
        if (next < 1000e8) next = 1000e8;
        price = int64(next);
    }

    function _proofAt(uint40 t) internal returns (bytes memory proof, uint256 fee) {
        address v = verifier;
        if (_have(v, t)) return ("", 0);
        proof = pyth.push(FEED, t, t - 1, price, CONF, EXPO);
        fee = pyth.FEE();
        vm.deal(address(this), address(this).balance + fee);
    }

    function _have(address v, uint40 t) internal view returns (bool) {
        (bool ok, bytes memory out) = address(reserve.windows())
            .staticcall(abi.encodeWithSignature("printOf(address,bytes32,uint40)", v, FEED, t));
        if (!ok) return false;
        (,, uint40 publishTime) = abi.decode(out, (int64, uint64, uint40));
        return publishTime != 0;
    }

    function _pick(uint256 seed) internal view returns (uint256, bool) {
        if (ids.length == 0) return (0, false);
        return (ids[seed % ids.length], true);
    }

    function _owed(Ride memory r) internal view returns (uint256) {
        return reserve.owedOf(r.recipient) + _balance(r.recipient);
    }

    /// @dev A ride never pays its rider more than margin + reserve in total (the pool's loss ≤ the reserve).
    function _checkPaid(uint256 id, Ride memory before, uint256 hadBefore) internal {
        Ride memory r = reserve.rideOf(id);
        uint256 got = _owed(r) - hadBefore;
        if (r.status == RIDE_REFUNDED) return;
        if (got > uint256(before.margin) + before.reserve + before.openFee) overpaid++;
    }

    function _balance(address a) internal view returns (uint256) {
        (bool ok, bytes memory out) =
            address(reserve.collateral()).staticcall(abi.encodeWithSignature("balanceOf(address)", a));
        return ok ? abi.decode(out, (uint256)) : 0;
    }

    function _count(bytes memory err) internal {
        if (err.length >= 4 && bytes4(err) == PANIC) panics++;
    }

    function _intent(uint8 action, bool isLong, uint256 rideId, uint64 margin, uint32 lev, uint128 size, int64 worst)
        internal
        returns (RideIntent memory)
    {
        return RideIntent({
            action: action,
            owner: owner,
            marketId: 0,
            isLong: isLong,
            rideId: rideId,
            margin: margin,
            leverageBps: lev,
            size: size,
            worstPriceE8: worst,
            recipient: owner,
            configVersion: reserve.configVersion(),
            deadline: uint64(vm.getBlockTimestamp() + 60),
            nonce: nonce++,
            epoch: reserve.epochOf(owner)
        });
    }

    function _sign(RideIntent memory it) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, reserve.hashRide(it));
        return abi.encodePacked(r, s, v);
    }

    function _noPermit() internal pure returns (Permit memory p) {}
}

/// @notice 07 §4: solvency to the unit, side sums == Σ rides, a conservative frontier, no rider paid past margin +
///         reserve, and no panic anywhere.
contract RidesInvariantTest is StdInvariant, RidesBase {
    RideHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new RideHandler(reserve, pyth, address(verifier));
        usd.mint(owner, 1_000_000e6);
        vm.prank(owner);
        usd.approve(address(reserve), type(uint256).max);
        targetContract(address(handler));
    }

    function invariant_noPanics() public view {
        assertEq(handler.panics(), 0, "a money path panicked");
    }

    function invariant_solventToTheUnit() public view {
        assertRidesBalance();
    }

    function invariant_noRiderPaidPastTheReserve() public view {
        assertEq(handler.overpaid(), 0);
    }

    /// @dev The run reached every exit, not just refusals.
    function afterInvariant() external view {
        uint256[8] memory seen;
        for (uint256 i = 1; i <= reserve.rideCount(); ++i) {
            seen[reserve.rideOf(i).status]++;
        }
        console2.log("open %s closed %s refunded %s", seen[RIDE_OPEN], seen[RIDE_CLOSED], seen[RIDE_REFUNDED]);
        console2.log("knocked out %s capped %s ended %s", seen[RIDE_KNOCKED_OUT], seen[RIDE_CAPPED], seen[RIDE_ENDED]);
    }

    function invariant_theFrontierIsConservative() public view {
        uint256 n = reserve.rideCount();
        RideSide memory longs = reserve.rideSideOf(BTC_RIDE, SIDE_LONG);
        RideSide memory shorts = reserve.rideSideOf(BTC_RIDE, SIDE_SHORT);
        for (uint256 i = 1; i <= n; ++i) {
            Ride memory r = reserve.rideOf(i);
            if (r.status != RIDE_OPEN) continue;
            if (r.isLong) {
                assertLe(r.koE8, longs.koEdgeE8, "long ko under the edge");
                assertGe(r.capE8, longs.capEdgeE8, "long cap over the edge");
            } else {
                assertGe(r.koE8, shorts.koEdgeE8, "short ko over the edge");
                assertLe(r.capE8, shorts.capEdgeE8, "short cap under the edge");
            }
        }
    }
}
