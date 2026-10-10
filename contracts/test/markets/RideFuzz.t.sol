// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {BandMath} from "../../src/markets/BandMath.sol";
import {LinearMath} from "../../src/markets/LinearMath.sol";
import {IRideBook} from "../../src/markets/interfaces/IRideBook.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {RidesBase} from "./RidesBase.t.sol";

/// @notice 07 §4's fuzz and differential tests: the mark against brute force, rounding against the account, the
///         spread curve inside its bounds, and the timing rules.
contract RideFuzzTest is RidesBase {
    uint256 internal constant MAX_RIDES = 6;

    /// @dev Any book of rides, marked at any print inside the frontier, is the sum of the rides' own PnL: each ride's
    ///      own PnL rounds against its rider and each side's sum rounds a rider's gain up once, so they differ by at most
    ///      a unit a ride, and always toward the pool owing more.
    function testFuzz_theMarkIsTheSumOfTheRides(uint256 seed, uint256 priceSeed) public {
        uint256 n = 1 + seed % MAX_RIDES;
        uint256[] memory ids = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            uint256 s = uint256(keccak256(abi.encode(seed, i)));
            ids[i] = openRide(s % 2 == 0, uint64(1e6 + s % 40e6), uint32(10_000 + (s >> 8) % 390_000));
            fillRide(ids[i], K + int64(int256((s >> 16) % 2000e8)) - 1000e8);
        }
        RideSide memory longs = reserve.rideSideOf(BTC_RIDE, SIDE_LONG);
        RideSide memory shorts = reserve.rideSideOf(BTC_RIDE, SIDE_SHORT);
        int64 lo = 1000e8;
        int64 hi = type(int64).max / 2;
        if (longs.count != 0) (lo, hi) = (longs.koEdgeE8, longs.capEdgeE8);
        if (shorts.count != 0) {
            if (shorts.capEdgeE8 > lo) lo = shorts.capEdgeE8;
            if (shorts.koEdgeE8 < hi) hi = shorts.koEdgeE8;
        }
        vm.assume(hi - lo > 2);
        int64 p = lo + 1 + int64(int256(priceSeed % uint256(int256(hi - lo - 1))));
        uint40 t = uint40(vm.getBlockTimestamp()) + 1;
        vm.warp(t + 1);
        record(t, p);
        int256 brute;
        for (uint256 i; i < n; ++i) {
            Ride memory r = reserve.rideOf(ids[i]);
            if (r.status == RIDE_OPEN) brute += LinearMath.pnl(r.isLong, r.size, r.entryE8, p);
        }
        assertApproxEqAbs(reserve.markRides(t), brute, n + SIDES);
        assertGe(reserve.markRides(t), brute, "riders' gains round up: the pool's value is never overstated");
    }

    /// @dev Every rounding goes against the account: the same move both ways never nets the rider anything, size
    ///      floors, and a part leaving a ride ceils.
    function testFuzz_roundingGoesAgainstTheAccount(uint128 size, uint64 entry, uint64 exit, uint64 notional)
        public
        pure
    {
        size = uint128(bound(size, 1, 1e30));
        int64 x = int64(uint64(bound(entry, 1, uint64(type(int64).max))));
        int64 y = int64(uint64(bound(exit, 1, uint64(type(int64).max))));
        int256 both = LinearMath.pnl(true, size, x, y) + LinearMath.pnl(false, size, x, y);
        assertLe(both, 0, "a long and a short on the same move never net a gain");
        notional = uint64(bound(notional, 1, 1e15));
        uint256 s = LinearMath.sizeOf(notional, x);
        assertLe(s * uint256(uint64(x)), uint256(notional) * RIDE_SCALE, "size floors");
        uint256 part = bound(entry, 0, size);
        assertGe(LinearMath.share(notional, part, size) * size, uint256(notional) * part, "a part leaving ceils");
    }

    /// @dev D-300's curve stays inside its floor and the chain's bound, so a close's bid stays positive and an open's
    ///      ask under $1 wherever the pool quotes.
    function testFuzz_theSpreadCurveStaysInBounds(uint256 p, uint32 h50) public pure {
        p = bound(p, MIN_PROB_FLOOR_E6, MAX_PROB_CEIL_E6);
        h50 = uint32(bound(h50, 1, MAX_HALF_SPREAD_E6));
        uint32 floor_ = 2500;
        uint256 h = BandMath.halfSpreadE6(p, h50, floor_);
        assertGe(h, floor_);
        assertLe(h, MAX_HALF_SPREAD_E6 > floor_ ? MAX_HALF_SPREAD_E6 : floor_);
        assertLt(h, p, "the bid stays positive");
        assertLt(p + h, P_ONE, "the ask stays under $1");
    }

    function test_aRideFillsOnlyAtItsOwnInstant() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        uint40 target = reserve.rideOf(id).target;
        vm.warp(target + 2);
        bytes memory other = printAt(target + 1, K + 5000e8);
        reserve.finalizeRides{value: pyth.FEE()}(target + 1, one(id), other);
        assertEq(reserve.rideOf(id).status, RIDE_COMMITTED, "a print of another instant is skipped");
        fillRide(id, K);
        assertEq(reserve.rideOf(id).entryE8, K);
    }

    function test_aCloseWaitsForTheMinimumHold() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        fillRide(id, K);
        uint40 canCloseAt = reserve.rideOf(id).filledAt + MIN_HOLD_SEC;
        vm.warp(canCloseAt - 1);
        RideIntent memory it = rideIntent(ACTION_CLOSE, true, id, 0, 0, 0, ANY_SHORT);
        bytes memory sig = signRide(OWNER_PK, it);
        vm.expectRevert(abi.encodeWithSelector(IRideBook.RideHeldTooShort.selector, id, canCloseAt));
        reserve.commitRide(it, sig, noPermit());
    }

    /// @dev D-267: a session spends a ride's margin and its open fee from its caps, and pays only the owner.
    function test_aSessionSpendsMarginAndFeeFromItsCaps() public {
        grant(20e6, 20e6, uint40(vm.getBlockTimestamp() + 600));
        RideIntent memory it = rideIntent(ACTION_OPEN, true, 0, 15e6, LEV40, 0, ANY_LONG);
        reserve.commitRide(it, signRide(DELEGATE_PK, it), noPermit());
        assertEq(reserve.sessionOf(owner).spent, 15e6 + 300_000, "margin + 5 bps of $600");
        it = rideIntent(ACTION_OPEN, true, 0, 5e6, LEV40, 0, ANY_LONG);
        bytes memory sig = signRide(DELEGATE_PK, it);
        vm.expectRevert();
        reserve.commitRide(it, sig, noPermit());
    }
}
