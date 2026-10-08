// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IBandReserve} from "../../src/markets/interfaces/IBandReserve.sol";
import {MarketsBase} from "./MarketsBase.t.sol";
import "../../src/markets/MarketTypes.sol";

/// @notice Settlement and payouts (D-263, D-264): every band decided once, money only to the ticket's own addresses.
contract SettleTest is MarketsBase {
    function test_winnerIsPaidTheWholePayoutAndLoserFundsThePool() public {
        uint256 up = open(UP, STAKE);
        fill(up, K);
        uint256 down = open(DOWN, STAKE);
        fill(down, K);
        uint64 upPayout = reserve.ticketOf(up).payout;
        uint64 downPayout = reserve.ticketOf(down).payout;
        uint256 poolBefore = reserve.liquid() + reserve.reserved();

        settle(K + 100e8); // closes above K: Up wins, Down loses
        assertEq(reserve.payableTotal(), upPayout);
        claim(up);
        claim(down);
        assertEq(reserve.ticketOf(up).status, TICKET_SETTLED);
        assertEq(usd.balanceOf(owner), WALLET - 2 * STAKE + upPayout);
        // The pool paid Up's reserve and won Down's stake (Down's own reserve came back to it).
        assertEq(reserve.liquid(), poolBefore - (upPayout - STAKE) + STAKE);
        assertGt(downPayout, STAKE);
        assertEq(reserve.reserved(), 0);
        assertEq(reserve.payableTotal(), 0);
        assertSolvent();
    }

    function test_closeExactlyAtKRefundsUpAndDown() public {
        uint256 up = open(UP, STAKE);
        fill(up, K + 20e8);
        uint256 down = open(DOWN, STAKE);
        fill(down, K + 20e8);
        settle(K);
        claim(up);
        claim(down);
        assertEq(usd.balanceOf(owner), WALLET, "both stakes back on a tie");
        assertEq(reserve.liquid(), POOL, "pool whole again");
        assertSolvent();
    }

    function test_voidedWindowRefundsTheBasis() public {
        uint256 up = open(UP, STAKE);
        fill(up, K);
        // No close print by expiry + admission: anyone voids the window.
        vm.warp(T0 + CADENCE + ADMISSION + 1);
        windows.voidExpired(windowId);
        reserve.settleWindow(windowId);
        claim(up);
        assertEq(usd.balanceOf(owner), WALLET);
        assertEq(reserve.liquid(), POOL);
        assertSolvent();
    }

    function test_partialCloseKeepsTheBasisProportional() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        Ticket memory t = reserve.ticketOf(id);
        vm.warp(block.timestamp + MIN_HOLD_SEC);
        closeShares(id, t.payout / 2);
        fill(id, K + 30e8); // a little in the money: the half sells above its basis
        Ticket memory after_ = reserve.ticketOf(id);
        assertEq(after_.status, TICKET_OPEN);
        assertEq(after_.payout, t.payout - t.payout / 2);
        // Basis leaving is ceiled: the remaining basis is at most half, never more than the remaining shares.
        assertLe(after_.stake, t.stake / 2 + 1);
        assertGe(after_.stake, t.stake / 2 - 1);
        assertLe(after_.stake, after_.payout);
        assertSolvent();

        // A void now refunds only the remaining basis.
        vm.warp(T0 + CADENCE + ADMISSION + 1);
        windows.voidExpired(windowId);
        reserve.settleWindow(windowId);
        uint256 walletBefore = usd.balanceOf(owner);
        claim(id);
        assertEq(usd.balanceOf(owner), walletBefore + after_.stake);
        assertSolvent();
    }

    function test_closeNeedsAHeldPositionAndANewerPrint() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        uint64 shares = reserve.ticketOf(id).payout;
        Intent memory it = intent(ACTION_CLOSE, 0, id, shares, 0);
        bytes memory sig = sign(OWNER_PK, it);
        uint40 canCloseAt = reserve.ticketOf(id).filledAt + MIN_HOLD_SEC;
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.HeldTooShort.selector, id, canCloseAt));
        reserve.commit(it, sig, noPermit());
    }

    function test_fullCashOutReleasesEverything() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        vm.warp(block.timestamp + MIN_HOLD_SEC);
        closeShares(id, reserve.ticketOf(id).payout);
        fill(id, K - 10e8);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED);
        assertEq(reserve.reserved(), 0);
        assertEq(reserve.escrowedStakes(), 0);
        assertLt(usd.balanceOf(owner), WALLET, "sold a little out of the money, below the stake");
        assertSolvent();
    }

    function test_overlappingBandsSettleIndependently() public {
        uint256 up = open(UP, STAKE);
        fill(up, K);
        uint256 range = open(RANGE, STAKE);
        fill(range, K);
        uint256 moon = open(MOON, STAKE);
        fill(moon, K + K / 1000); // spot +0.1 %, strike +0.3 %: priced inside the band
        assertEq(reserve.ticketOf(moon).status, TICKET_OPEN);
        uint64 upPay = reserve.ticketOf(up).payout;
        uint64 rangePay = reserve.ticketOf(range).payout;

        // Close +0.1 %: above K (Up wins), inside ±0.15 % (Range wins), below +0.3 % (Moonshot loses).
        settle(K + K / 1000);
        uint256[] memory ids = new uint256[](3);
        (ids[0], ids[1], ids[2]) = (up, range, moon);
        reserve.claimFor(ids);
        assertEq(usd.balanceOf(owner), WALLET - 3 * STAKE + upPay + rangePay);
        assertEq(reserve.bandOutcome(windowId, UP), OUTCOME_WIN);
        assertEq(reserve.bandOutcome(windowId, RANGE), OUTCOME_WIN);
        assertEq(reserve.bandOutcome(windowId, MOON), OUTCOME_LOSE);
        assertEq(reserve.reserved(), 0);
        assertSolvent();
    }

    function test_rangeEdgesAreInclusiveAndMoonshotStrikeExcluded() public {
        uint256 range = open(RANGE, STAKE);
        fill(range, K);
        uint256 moon = open(MOON, STAKE);
        fill(moon, K + K / 1000);
        int64 rangeHigh = K + K * 15 / 10_000; // exactly on the upper edge
        settle(rangeHigh);
        assertEq(reserve.bandOutcome(windowId, RANGE), OUTCOME_WIN);
        assertEq(reserve.bandOutcome(windowId, MOON), OUTCOME_LOSE);
    }

    function test_commitThatNeverFilledIsRefundedAtSettlement() public {
        uint256 id = open(UP, STAKE);
        settle(K + 50e8);
        claim(id);
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED);
        assertEq(usd.balanceOf(owner), WALLET);
        assertSolvent();
    }

    function test_blockedRecipientIsOwedNotLost() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        uint64 payout = reserve.ticketOf(id).payout;
        settle(K + 100e8);
        usd.setBlocked(owner, true);
        claim(id);
        assertEq(reserve.owedOf(owner), payout);
        assertEq(reserve.totalOwed(), payout);
        assertSolvent();
        usd.setBlocked(owner, false);
        vm.prank(owner);
        reserve.claimOwed();
        assertEq(usd.balanceOf(owner), WALLET - STAKE + payout);
        assertSolvent();
    }

    function test_settlementIsOnceAndClaimsAreOnce() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        settle(K + 100e8);
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.WindowAlreadySettled.selector, windowId));
        reserve.settleWindow(windowId);
        claim(id);
        uint256 wallet = usd.balanceOf(owner);
        claim(id); // a second crank is a no-op
        assertEq(usd.balanceOf(owner), wallet);
        assertSolvent();
    }
}
