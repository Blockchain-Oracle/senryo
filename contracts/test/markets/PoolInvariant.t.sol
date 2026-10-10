// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test, console2} from "forge-std/Test.sol";
import {BandReserve} from "../../src/markets/BandReserve.sol";
import {ISharedPool, PoolShares} from "../../src/markets/PoolShares.sol";
import {Windows} from "../../src/markets/Windows.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {RidesBase} from "./RidesBase.t.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

/// @dev Calls, rides and Earn on one pool over one random-walk price: 5-minute windows opened, filled, settled and
///      paid; rides opened, closed and bounded; supplies, withdrawals and rolls (bounds proved and frontiers refreshed
///      first, as the keeper will). Refusals are swallowed, panics counted.
contract PoolHandler is Test {
    uint256 internal constant OWNER_PK = 0xA11CE;
    uint256 internal constant SIGNER_PK = 0x516A;
    bytes32 internal constant FEED = keccak256("BTC/USD");
    uint40 internal constant CADENCE = 300;
    uint40 internal constant HOUR = 3600;
    int32 internal constant EXPO = -8;
    uint64 internal constant CONF = 1e8;
    uint256 internal constant STEP_BPS = 40;
    bytes4 internal constant PANIC = 0x4e487b71;

    BandReserve internal reserve;
    PoolShares internal shares;
    MockPyth internal pyth;
    Windows internal windows;
    address internal verifier;
    bytes32 internal seriesId;
    address internal owner;
    address internal supplier;
    int64 public price = 60_000e8;
    uint256 public panics;
    uint256 internal nonce = 1 << 129;
    uint256[] internal tickets;
    uint256[] internal rides;
    bytes32[] internal windowIds;
    mapping(bytes32 => uint40) internal startOf;

    constructor(BandReserve r, PoolShares s, MockPyth p, Windows w, address v, bytes32 series, address supplier_) {
        (reserve, shares, pyth, windows, verifier, seriesId, supplier) = (r, s, p, w, v, series, supplier_);
        owner = vm.addr(OWNER_PK);
    }

    receive() external payable {}

    // ------------------------------------------------------------------------------------------------ calls

    function call(uint8 band, uint256 seed) external {
        _tick(seed);
        bytes32 w = _currentWindow();
        if (w == bytes32(0)) return;
        Intent memory it = Intent(
            ACTION_OPEN,
            owner,
            w,
            band % 4,
            0,
            uint64(bound(seed, 1e6, 30e6)),
            0,
            owner,
            reserve.configVersion(),
            uint64(_now() + 60),
            nonce++,
            reserve.epochOf(owner)
        );
        try reserve.commit(it, _sign(reserve.hashIntent(it)), _noPermit()) returns (uint256 id) {
            tickets.push(id);
            _fillTicket(id);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    function settleWindows() external {
        _tick(1);
        for (uint256 i; i < windowIds.length; ++i) {
            bytes32 w = windowIds[i];
            uint40 expiry = startOf[w] + CADENCE;
            if (_now() <= expiry || reserve.windowSettled(w)) continue;
            if (windows.windowOf(w).state == STATE_OPEN) {
                if (_now() <= expiry + CADENCE) _record(expiry);
                try windows.resolve(w) {} catch {}
                try windows.voidExpired(w) {} catch {}
            }
            try reserve.settleWindow(w) {}
            catch (bytes memory err) {
                _count(err);
            }
        }
        if (tickets.length == 0) return;
        uint256 n = tickets.length < MAX_BATCH ? tickets.length : MAX_BATCH;
        uint256[] memory batch = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            batch[i] = tickets[tickets.length - 1 - i];
        }
        try reserve.claimFor(batch) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    // ------------------------------------------------------------------------------------------------ rides

    function ride(bool isLong, uint256 seed) external {
        _tick(seed);
        RideIntent memory it = RideIntent(
            ACTION_OPEN,
            owner,
            0,
            isLong,
            0,
            uint64(bound(seed, 1e6, 30e6)),
            uint32(bound(seed >> 8, MIN_LEVERAGE_BPS, 400_000)),
            0,
            isLong ? type(int64).max : int64(1),
            owner,
            reserve.configVersion(),
            uint64(_now() + 60),
            nonce++,
            reserve.epochOf(owner)
        );
        try reserve.commitRide(it, _sign(reserve.hashRide(it)), _noPermit()) returns (uint256 id) {
            rides.push(id);
            _fillRide(id);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    function closeRide(uint256 seed) external {
        if (rides.length == 0) return;
        _tick(seed);
        uint256 id = rides[seed % rides.length];
        Ride memory r = reserve.rideOf(id);
        if (r.status != RIDE_OPEN || r.closing != 0) return;
        if (_now() < r.filledAt + MIN_HOLD_SEC) vm.warp(r.filledAt + MIN_HOLD_SEC);
        RideIntent memory it = RideIntent(
            ACTION_CLOSE,
            owner,
            0,
            r.isLong,
            id,
            0,
            0,
            seed % 2 == 0 ? 0 : r.size / 2,
            r.isLong ? int64(1) : type(int64).max,
            owner,
            reserve.configVersion(),
            uint64(_now() + 60),
            nonce++,
            reserve.epochOf(owner)
        );
        try reserve.commitRide(it, _sign(reserve.hashRide(it)), _noPermit()) {
            _fillRide(id);
        } catch (bytes memory err) {
            _count(err);
        }
    }

    // ------------------------------------------------------------------------------------------------ Earn

    function earn(bool supplyOrWithdraw, uint256 seed) external {
        _tick(seed);
        if (supplyOrWithdraw) {
            vm.prank(supplier);
            try shares.requestSupply(bound(seed, 1e6, 5000e6)) {}
            catch (bytes memory err) {
                _count(err);
            }
        } else {
            uint256 mine = shares.balanceOf(supplier);
            if (mine == 0) return;
            vm.prank(supplier);
            try shares.requestWithdraw(bound(seed, 1, mine)) {}
            catch (bytes memory err) {
                _count(err);
            }
        }
        shares.claim(supplier);
    }

    /// @dev The keeper's hour: settle what ends in it, prove every crossed bound at the mark, refresh, roll.
    function roll() external {
        uint40 next = shares.lastRoll() == 0 ? uint40(_now() - _now() % HOUR) : shares.lastRoll() + HOUR;
        if (_now() < next) vm.warp(next);
        this.settleWindows();
        uint40 markAt = uint40(_now());
        _record(markAt);
        uint256[] memory open_ = _openRides();
        if (open_.length != 0) {
            try reserve.settleBounds(markAt, open_, "") {}
            catch (bytes memory err) {
                _count(err);
            }
        }
        _refresh(true);
        _refresh(false);
        try shares.roll(next, markAt) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    // ------------------------------------------------------------------------------------------------ helpers

    function _currentWindow() internal returns (bytes32 w) {
        uint40 start = uint40(_now() - _now() % CADENCE);
        w = windows.windowIdOf(seriesId, start);
        if (windows.windowOf(w).expiry == 0) {
            try windows.openWindow(seriesId, start) {}
            catch {
                return bytes32(0);
            }
            windowIds.push(w);
            startOf[w] = start;
            _record(start);
        }
        if (windows.openPrintOf(w).publishTime == 0) return bytes32(0);
    }

    function _fillTicket(uint256 id) internal {
        uint40 target = reserve.ticketOf(id).target;
        if (_now() <= target) vm.warp(target + 1);
        PrintSource memory src = windows.primarySourceOf(reserve.ticketOf(id).windowId);
        (SigmaMark memory m, bytes memory sig) = _mark(target);
        uint256[] memory one = new uint256[](1);
        one[0] = id;
        (bytes memory proof, uint256 fee) = _proof(src.feedId, target);
        try reserve.finalize{value: fee}(target, one, proof, m, sig) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    function _fillRide(uint256 id) internal {
        uint40 target = reserve.rideOf(id).target;
        if (_now() <= target) vm.warp(target + 1);
        uint256[] memory one = new uint256[](1);
        one[0] = id;
        (bytes memory proof, uint256 fee) = _proof(FEED, target);
        try reserve.finalizeRides{value: fee}(target, one, proof) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    function _openRides() internal view returns (uint256[] memory out) {
        uint256 n;
        for (uint256 i; i < rides.length; ++i) {
            if (reserve.rideOf(rides[i]).status == RIDE_OPEN) ++n;
        }
        out = new uint256[](n < MAX_RIDE_BATCH ? n : MAX_RIDE_BATCH);
        n = 0;
        for (uint256 i; i < rides.length && n < out.length; ++i) {
            if (reserve.rideOf(rides[i]).status == RIDE_OPEN) out[n++] = rides[i];
        }
    }

    function _refresh(bool isLong) internal {
        uint256 n;
        for (uint256 i; i < rides.length; ++i) {
            Ride memory r = reserve.rideOf(rides[i]);
            if (r.status == RIDE_OPEN && r.isLong == isLong) ++n;
        }
        uint256[] memory ids = new uint256[](n);
        n = 0;
        for (uint256 i; i < rides.length; ++i) {
            Ride memory r = reserve.rideOf(rides[i]);
            if (r.status == RIDE_OPEN && r.isLong == isLong) ids[n++] = rides[i];
        }
        try reserve.refreshFrontier(0, isLong ? SIDE_LONG : SIDE_SHORT, ids) {}
        catch (bytes memory err) {
            _count(err);
        }
    }

    function _tick(uint256 seed) internal {
        vm.warp(_now() + 1 + seed % 25);
        int256 move = int256(price) * (int256(seed % (2 * STEP_BPS + 1)) - int256(STEP_BPS)) / int256(BPS);
        price = int64(int256(price) + move);
    }

    function _record(uint40 t) internal {
        if (windows.printOf(verifier, FEED, t).publishTime != 0) return;
        bytes memory proof = pyth.push(FEED, t, t - 1, price, CONF, EXPO);
        uint256 fee = pyth.FEE();
        vm.deal(address(this), address(this).balance + fee);
        try windows.recordPrint{value: fee}(verifier, FEED, t, proof) {} catch {}
    }

    function _proof(bytes32 feed, uint40 t) internal returns (bytes memory proof, uint256 fee) {
        if (windows.printOf(verifier, feed, t).publishTime != 0) return ("", 0);
        proof = pyth.push(feed, t, t - 1, price, CONF, EXPO);
        fee = pyth.FEE();
        vm.deal(address(this), address(this).balance + fee);
    }

    function _mark(uint40 target) internal view returns (SigmaMark memory m, bytes memory sig) {
        m = SigmaMark(FEED, reserve.markMinuteOf(target), 8900, 8900);
        bytes32 structHash =
            keccak256(abi.encode(reserve.SIGMA_MARK_TYPEHASH(), m.feedId, m.minute, m.fastE8, m.slowE8));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(SIGNER_PK, keccak256(abi.encodePacked("\x19\x01", reserve.domainSeparator(), structHash)));
        sig = abi.encodePacked(r, s, v);
    }

    function _sign(bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _noPermit() internal pure returns (Permit memory p) {}

    function _now() internal view returns (uint256) {
        return vm.getBlockTimestamp();
    }

    function _count(bytes memory err) internal {
        if (err.length >= 4 && bytes4(err) == PANIC) panics++;
    }

    function rideIds() external view returns (uint256[] memory) {
        return rides;
    }
}

/// @notice 07 §4 across every book: the token balance is every unit's home exactly, ride sums equal their rides, Earn
///         holds exactly what its requests and claims are owed, and nothing panics.
contract PoolInvariantTest is StdInvariant, RidesBase {
    uint64 internal constant POOL_ROLE = 3;
    PoolShares internal shares;
    PoolHandler internal handler;
    address internal supplier = makeAddr("supplier");

    function setUp() public override {
        super.setUp();
        shares = new PoolShares(address(manager), ISharedPool(address(reserve)));
        bytes4[] memory doors = new bytes4[](3);
        (doors[0], doors[1], doors[2]) =
        (reserve.fund.selector, reserve.defund.selector, reserve.setWithdrawHold.selector);
        manager.setTargetFunctionRole(address(reserve), doors, POOL_ROLE);
        manager.grantRole(POOL_ROLE, address(shares), 0);
        shares.seed(address(this));
        handler = new PoolHandler(reserve, shares, pyth, windows, address(verifier), seriesId, supplier);
        usd.mint(owner, 1_000_000e6);
        vm.prank(owner);
        usd.approve(address(reserve), type(uint256).max);
        usd.mint(supplier, 1_000_000e6);
        vm.prank(supplier);
        usd.approve(address(shares), type(uint256).max);
        targetContract(address(handler));
    }

    /// @dev The run reached every book, not just refusals.
    function afterInvariant() external view {
        uint256[6] memory t;
        for (uint256 i = 1; i <= reserve.ticketCount(); ++i) {
            t[reserve.ticketOf(i).status]++;
        }
        uint256[8] memory r;
        for (uint256 i = 1; i <= reserve.rideCount(); ++i) {
            r[reserve.rideOf(i).status]++;
        }
        console2.log("tickets open %s closed %s settled %s", t[TICKET_OPEN], t[TICKET_CLOSED], t[TICKET_SETTLED]);
        console2.log("tickets refunded %s; rides open %s closed %s", t[TICKET_REFUNDED], r[RIDE_OPEN], r[RIDE_CLOSED]);
        console2.log(
            "rolls to %s; supplier shares %s; pool %s", shares.lastRoll(), shares.balanceOf(supplier), reserve.liquid()
        );
    }

    function invariant_noPanics() public view {
        assertEq(handler.panics(), 0, "a money path panicked");
    }

    function invariant_everyUnitHasAHome() public view {
        assertRidesBalance();
    }

    function invariant_earnHoldsWhatItOwes() public view {
        (uint40 hour, uint256 pending) = shares.supplyOf(supplier);
        (,,, bool done,) = shares.supplyBatch(hour);
        uint256 owedAssets = done ? 0 : pending;
        (uint40 wHour, uint256 wPending) = shares.withdrawOf(supplier);
        (, uint256 num, uint256 den, bool wDone,) = shares.withdrawBatch(wHour);
        if (wDone) owedAssets += wPending * num / den;
        assertGe(usd.balanceOf(address(shares)), owedAssets, "Earn holds its waiting supplies and settled withdrawals");
    }
}
