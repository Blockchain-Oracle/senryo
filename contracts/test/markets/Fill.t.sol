// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IBandReserve} from "../../src/markets/interfaces/IBandReserve.sol";
import {PythPrintVerifier} from "../../src/markets/PythPrintVerifier.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MarketsBase} from "./MarketsBase.t.sol";
import "../../src/markets/MarketTypes.sol";

/// @notice Commit-then-fill (D-261) and pricing (D-262): money in, the price nobody can pick, refusals by name.
contract FillTest is MarketsBase {
    function test_commitEscrowsTheStake() public {
        uint256 id = open(UP, STAKE);
        Ticket memory t = reserve.ticketOf(id);
        assertEq(t.status, TICKET_COMMITTED);
        assertEq(t.target, uint40(block.timestamp) + FILL_DELAY_SEC);
        assertEq(usd.balanceOf(owner), WALLET - STAKE);
        assertEq(reserve.committedStakes(), STAKE);
        assertSolvent();
    }

    function test_fillAtTheUniquePrintReservesTheWholePayout() public {
        uint256 id = open(UP, STAKE);
        uint256 liquidBefore = reserve.liquid();
        fill(id, K);
        Ticket memory t = reserve.ticketOf(id);
        assertEq(t.status, TICKET_OPEN);
        assertEq(t.entryE8, K);
        // At the money with ~5 min left: ≈ 50 % + 2 pp spread → a payout just under 2× the stake.
        assertGt(t.payout, STAKE * 18 / 10);
        assertLt(t.payout, STAKE * 2);
        uint256 reserveTaken = t.payout - t.stake;
        assertEq(reserve.reserved(), reserveTaken);
        assertEq(reserve.liquid(), liquidBefore - reserveTaken);
        assertEq(reserve.escrowedStakes(), STAKE);
        assertEq(reserve.committedStakes(), 0);
        assertSolvent();
    }

    function test_aPrintForAnotherInstantCannotFill() public {
        uint256 id = open(UP, STAKE);
        uint40 target = reserve.ticketOf(id).target;
        vm.warp(target + 3);
        // A print published at target + 2 whose previous print is at/after the target is not "the" print of target.
        bytes memory later = pyth.push(BTC_FEED, target + 2, target + 1, K + 500e8, CONF, EXPO);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint256 fee = pyth.FEE();
        vm.expectRevert(MockPyth.PriceFeedNotFoundWithinRange.selector);
        reserve.finalize{value: fee}(target, ids, later);
        // An older print (before the target) can't be passed off either.
        bytes memory older = pyth.push(BTC_FEED, target - 1, target - 2, K - 500e8, CONF, EXPO);
        vm.expectRevert(MockPyth.PriceFeedNotFoundWithinRange.selector);
        reserve.finalize{value: fee}(target, ids, older);
        assertEq(reserve.ticketOf(id).status, TICKET_COMMITTED);
    }

    function test_noCallBeforeTheOpenPrint() public {
        vm.warp(T0 + CADENCE - 30);
        bytes32 next = windows.openWindow(seriesId, T0 + CADENCE);
        vm.warp(T0 + CADENCE + 2);
        windowId = next;
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        bytes memory sig = sign(OWNER_PK, it);
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.NoOpenPrint.selector, next));
        reserve.commit(it, sig, noPermit());
    }

    function test_noCommitInsideTheLockout() public {
        vm.warp(T0 + CADENCE - LOCKOUT_SEC);
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        bytes memory sig = sign(OWNER_PK, it);
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.WindowNotTrading.selector, windowId));
        reserve.commit(it, sig, noPermit());
    }

    function test_refusesOutsideTheProbabilityBandAndRefunds() public {
        // A Moonshot +0.3 % when the price has just fallen 1 %: far below 3 %, refused, never clamped.
        uint256 id = open(MOON, STAKE);
        fill(id, K - K / 100);
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED);
        assertEq(usd.balanceOf(owner), WALLET);
        // An Up when the price is already 1 % above K: above 97 %, refused too.
        uint256 id2 = open(UP, STAKE);
        fill(id2, K + K / 100);
        assertEq(reserve.ticketOf(id2).status, TICKET_REFUNDED);
        assertEq(usd.balanceOf(owner), WALLET);
        assertEq(reserve.reserved(), 0);
        assertSolvent();
    }

    function test_slippageLimitRefuses() public {
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, STAKE * 3); // asks for 3×: impossible at the money
        uint256 id = reserve.commit(it, sign(OWNER_PK, it), noPermit());
        fill(id, K);
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED);
        assertEq(usd.balanceOf(owner), WALLET);
    }

    function test_noFillAfterTheWindowEnds() public {
        uint256 id = open(UP, STAKE);
        uint40 target = reserve.ticketOf(id).target;
        bytes memory proof = printAt(target, K);
        vm.warp(T0 + CADENCE);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        reserve.finalize{value: pyth.FEE()}(target, ids, proof);
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED, "late fill refused: nobody may wait for the close");
        assertEq(usd.balanceOf(owner), WALLET);
        assertSolvent();
    }

    function test_noPrintMeansARefund() public {
        uint256 id = open(UP, STAKE);
        uint40 target = reserve.ticketOf(id).target;
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        vm.warp(target + 10);
        reserve.expire(ids);
        assertEq(reserve.ticketOf(id).status, TICKET_COMMITTED, "the print may still be recorded");
        // The window ends before a 300 s admission would: from then on the call can only be refunded.
        vm.warp(T0 + CADENCE);
        reserve.expire(ids);
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED);
        assertEq(usd.balanceOf(owner), WALLET);
        assertSolvent();
    }

    function test_finalizeIsIdempotent() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        uint64 payout = reserve.ticketOf(id).payout;
        uint40 target = reserve.ticketOf(id).target;
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        reserve.finalize(target, ids, ""); // print already recorded: no fee, no proof, no change
        assertEq(reserve.ticketOf(id).payout, payout);
        assertSolvent();
    }

    function test_exposureCapRefusesInsteadOfOverReserving() public {
        // Shrink the pool so one large call would push reserved capital past 60 % of the pool.
        reserve.defund(reserve.liquid() - 1000e6, address(this));
        Intent memory it = intent(ACTION_OPEN, MOON, 0, 1000e6, 0);
        uint256 id = reserve.commit(it, sign(OWNER_PK, it), noPermit());
        fill(id, K + K / 1000); // spot near the strike: the moonshot pays a few × — far more reserve than allowed
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED);
        assertEq(reserve.reserved(), 0);
        assertSolvent();
    }

    function test_lowQualityPrintIsRefused() public {
        uint256 id = open(UP, STAKE);
        uint40 target = reserve.ticketOf(id).target;
        vm.warp(target + 1);
        bytes memory wide = pyth.push(BTC_FEED, target, target - 1, K, uint64(uint256(int256(K)) / 100), EXPO);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint256 fee = pyth.FEE();
        vm.expectRevert(
            abi.encodeWithSelector(PythPrintVerifier.LowQuality.selector, K, uint64(uint256(int256(K)) / 100))
        );
        reserve.finalize{value: fee}(target, ids, wide);
    }
}
