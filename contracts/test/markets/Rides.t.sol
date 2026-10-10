// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {LinearMath} from "../../src/markets/LinearMath.sol";
import {IRideBook} from "../../src/markets/interfaces/IRideBook.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {RidesBase} from "./RidesBase.t.sol";

/// @notice D-299/D-301: a ride fills at the next print with its whole profit reserved, closes at a later one, and is
///         knocked out, capped or ended at recorded prints — every unit has a home throughout.
contract RidesTest is RidesBase {
    address internal constant PROVER = address(0xBEEF);

    /// @dev 07 §2.2's worked example: $10 at 40× on BTC at $60,000.
    function test_aRideFillsAtTheNextPrintWithItsProfitReserved() public {
        uint256 before = usd.balanceOf(owner);
        uint256 id = openRide(true, MARGIN, LEV40);
        uint64 fee = reserve.rideOf(id).openFee;
        assertEq(fee, 200_000, "5 bps of $400");
        assertEq(before - usd.balanceOf(owner), MARGIN + fee);
        fillRide(id, K);

        Ride memory r = reserve.rideOf(id);
        assertEq(r.status, RIDE_OPEN);
        assertEq(r.entryE8, K, "no spread: the entry is the print");
        assertEq(r.reserve, 90e6, "min(900 %, 40 x 25 %) of the margin");
        assertEq(r.koE8, 58_650e8, "90 % of the margin lost at -2.25 %");
        assertEq(r.capE8, 73_500e8 + 1, "the reserve won at +22.5 % (the distance ceils, against the rider)");
        assertEq(reserve.margins(), MARGIN);
        assertEq(reserve.linearReserved(), 90e6);
        assertRidesBalance();
    }

    function test_aCloseFillsAtItsOwnPrintAndPaysTheEquityLessFees() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        fillRide(id, K);
        vm.warp(reserve.rideOf(id).filledAt + 20); // past the early-close window
        uint256 before = usd.balanceOf(owner);
        uint256 liquidBefore = reserve.liquid();
        closeRide(id, 0);
        fillRide(id, K + 600e8); // +1 %: +$4 on $400
        Ride memory r = reserve.rideOf(id);
        assertEq(r.status, RIDE_CLOSED);
        uint256 size = LinearMath.sizeOf(400e6, K);
        int256 pnl = LinearMath.pnl(true, size, K, K + 600e8);
        // Closing the only side reduces the pool's skew: the maker rate (D-301).
        uint256 fee = LinearMath.feeOf(LinearMath.notionalAt(size, K + 600e8), MAKER);
        uint256 paid = uint256(int256(uint256(MARGIN)) + pnl) - fee;
        assertEq(usd.balanceOf(owner) - before, paid, "margin + PnL - the close fee");
        assertEq(reserve.liquid(), liquidBefore + MARGIN + 90e6 - paid, "the pool keeps the rest of the escrow");
        assertRidesBalance();
    }

    function test_aProfitableCloseInsideFifteenSecondsPaysTheEarlyFee() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        fillRide(id, K);
        vm.warp(reserve.rideOf(id).filledAt + MIN_HOLD_SEC);
        uint256 before = usd.balanceOf(owner);
        closeRide(id, 0);
        fillRide(id, K + 600e8);
        uint256 size = LinearMath.sizeOf(400e6, K);
        int256 pnl = LinearMath.pnl(true, size, K, K + 600e8);
        uint256 exitN = LinearMath.notionalAt(size, K + 600e8);
        uint256 age = MIN_HOLD_SEC + params().fillDelaySec;
        uint256 early = LinearMath.earlyFee(exitN, pnl, age, 20, 15);
        assertGt(early, 0);
        assertEq(
            usd.balanceOf(owner) - before,
            uint256(int256(uint256(MARGIN)) + pnl) - LinearMath.feeOf(exitN, MAKER) - early
        );
        assertRidesBalance();
    }

    function test_aKnockOutIsProvedAtARecordedPrintAndPaysTheProver() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        fillRide(id, K);
        uint40 filled = reserve.rideOf(id).filledAt;
        uint256 before = usd.balanceOf(owner);
        bounds(filled + 30, 58_700e8, one(id)); // above the KO: nothing happens
        assertEq(reserve.rideOf(id).status, RIDE_OPEN);

        bytes memory proof = printAt(filled + 60, 58_600e8);
        vm.warp(filled + 61);
        uint256 fee = pyth.FEE();
        vm.deal(PROVER, fee);
        vm.prank(PROVER);
        reserve.settleBounds{value: fee}(filled + 60, one(id), proof);
        assertEq(reserve.rideOf(id).status, RIDE_KNOCKED_OUT);
        assertEq(usd.balanceOf(owner), before, "the rider gets nothing");
        assertEq(usd.balanceOf(PROVER), LinearMath.keeperFee(MARGIN), "2 % of the margin to the prover");
        assertRidesBalance();
    }

    function test_noBoundBeforeTheFillCounts() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        uint40 target = reserve.rideOf(id).target;
        record(target - 1, 50_000e8); // a crash a second before the fill
        fillRide(id, K);
        bounds(target - 1, 50_000e8, one(id));
        assertEq(reserve.rideOf(id).status, RIDE_OPEN, "only prints at or after the fill");
    }

    function test_aCapOutPaysTheWholeReserve() public {
        uint256 id = openRide(false, MARGIN, LEV40); // short: capped 22.5 % down
        fillRide(id, K);
        uint256 before = usd.balanceOf(owner);
        uint40 t = reserve.rideOf(id).filledAt + 30;
        bounds(t, 46_000e8, one(id));
        assertEq(reserve.rideOf(id).status, RIDE_CAPPED);
        uint256 size = LinearMath.sizeOf(400e6, K);
        uint256 fee = LinearMath.feeOf(LinearMath.notionalAt(size, 46_000e8), MAKER);
        assertEq(usd.balanceOf(owner) - before, MARGIN + 90e6 - fee);
        assertRidesBalance();
    }

    function test_aRideEndsAtTheEndOfItsLife() public {
        uint256 id = openRide(true, MARGIN, LEV10);
        fillRide(id, K);
        uint40 end = reserve.rideOf(id).filledAt + LIFE;
        vm.warp(end + 1);
        bytes memory proof = printAt(end, K - 100e8);
        reserve.settleEnds{value: pyth.FEE()}(end, one(id), proof);
        assertEq(reserve.rideOf(id).status, RIDE_ENDED);
        assertRidesBalance();
    }

    function test_aPartialCloseLeavesTheBoundsAndTheSumsRight() public {
        uint256 id = openRide(true, MARGIN, LEV40);
        fillRide(id, K);
        Ride memory r = reserve.rideOf(id);
        vm.warp(r.filledAt + 20);
        closeRide(id, r.size / 3);
        fillRide(id, K - 200e8);
        Ride memory after_ = reserve.rideOf(id);
        assertEq(after_.status, RIDE_OPEN);
        assertEq(after_.size, r.size - r.size / 3);
        assertEq(after_.koE8, r.koE8, "the knock-out never drifts");
        assertEq(after_.capE8, r.capE8);
        assertRidesBalance();
    }

    function test_refusalsRefundMarginAndFee() public {
        uint256 before = usd.balanceOf(owner);
        // Slippage: a long that accepts at most K, filled above it.
        RideIntent memory it = rideIntent(ACTION_OPEN, true, 0, MARGIN, LEV40, 0, K);
        uint256 id = reserve.commitRide(it, signRide(OWNER_PK, it), noPermit());
        fillRide(id, K + 1e8);
        assertEq(reserve.rideOf(id).status, RIDE_REFUNDED);
        // The terms moved between the commit and the fill.
        id = openRide(true, MARGIN, LEV40);
        reserve.setRideTerms(
            RideTerms({maxLinearBps: 3000, maxHourlyLossBps: 1000, earlyFeeBps: 20, earlyWindowSec: 15})
        );
        fillRide(id, K);
        assertEq(reserve.rideOf(id).status, RIDE_REFUNDED);
        // No print within admission.
        id = openRide(true, MARGIN, LEV40);
        vm.warp(reserve.rideOf(id).target + ADMISSION + 1);
        reserve.expireRides(one(id));
        assertEq(reserve.rideOf(id).status, RIDE_REFUNDED);
        assertEq(usd.balanceOf(owner), before, "every refusal refunds margin and fee");
        assertRidesBalance();
    }

    function test_theSkewReducingSideGetsTheMakerRate() public {
        fillRide(openRide(true, MARGIN, LEV40), K);
        uint256 before = usd.balanceOf(owner);
        uint256 id = openRide(false, MARGIN, LEV10); // $100 short against $400 long: reduces the skew
        fillRide(id, K);
        uint64 fee = reserve.rideOf(id).openFee;
        assertEq(fee, LinearMath.feeOf(100e6, MAKER));
        assertEq(before - usd.balanceOf(owner), MARGIN + fee, "the taker over-charge comes back");
        assertRidesBalance();
    }

    /// @dev Earn's mark (D-307) is the brute-force sum, and refuses while a side's frontier is at a bound.
    function test_theMarkEqualsTheSumAndRefusesPastABound() public {
        uint256 a = openRide(true, MARGIN, LEV40);
        uint256 b = openRide(false, 20e6, LEV10);
        fillRide(a, K);
        fillRide(b, K);
        uint40 t = reserve.rideOf(a).filledAt + 10;
        vm.warp(t + 2);
        record(t, K + 300e8);
        int256 want = LinearMath.pnl(true, reserve.rideOf(a).size, K, K + 300e8)
            + LinearMath.pnl(false, reserve.rideOf(b).size, K, K + 300e8);
        assertApproxEqAbs(reserve.markRides(t), want, 2, "sums vs rides (rounding at most a unit a side)");

        record(t + 1, 58_000e8); // past the long's knock-out
        vm.expectRevert(abi.encodeWithSelector(IRideBook.PastBound.selector, BTC_RIDE, SIDE_LONG));
        reserve.markRides(t + 1);
        bounds(t + 1, 58_000e8, one(a));
        // The long side emptied, so its edge resets; the short side marks.
        // The mark rounds riders' gains up (the pool's value is never overstated): at most a unit off the close PnL.
        assertApproxEqAbs(reserve.markRides(t + 1), LinearMath.pnl(false, reserve.rideOf(b).size, K, 58_000e8), 1);
        assertRidesBalance();
    }

    function test_theFrontierRefreshTakesEveryOpenRide() public {
        uint256 a = openRide(true, MARGIN, LEV40);
        uint256 b = openRide(true, MARGIN, LEV10);
        fillRide(a, K);
        fillRide(b, K);
        vm.warp(reserve.rideOf(a).filledAt + 20);
        closeRide(a, 0);
        fillRide(a, K);
        assertEq(reserve.rideSideOf(BTC_RIDE, SIDE_LONG).koEdgeE8, reserve.rideOf(a).koE8, "a stale edge stays");
        vm.expectRevert(abi.encodeWithSelector(IRideBook.BadFrontier.selector, BTC_RIDE, SIDE_LONG));
        reserve.refreshFrontier(BTC_RIDE, SIDE_LONG, new uint256[](0));
        reserve.refreshFrontier(BTC_RIDE, SIDE_LONG, one(b));
        assertEq(reserve.rideSideOf(BTC_RIDE, SIDE_LONG).koEdgeE8, reserve.rideOf(b).koE8);
    }
}
