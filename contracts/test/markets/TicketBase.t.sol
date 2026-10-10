// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IBandReserve} from "../../src/markets/interfaces/IBandReserve.sol";
import {MarketsBase} from "./MarketsBase.t.sol";
import "../../src/markets/MarketTypes.sol";

/// @notice D-314: a reserve numbers its tickets after `ticketBase`, so testnet's v3 ids never repeat v1's. Every path
///         that names a ticket — fill, close, settle, claim — works on the shifted ids, and none below them exists.
contract TicketBaseTest is MarketsBase {
    uint256 internal constant BASE = 1000;

    function firstTicketAfter() internal pure override returns (uint256) {
        return BASE;
    }

    function test_idsStartAfterTheBase() public {
        assertEq(reserve.ticketBase(), BASE);
        uint256 first = open(UP, STAKE);
        uint256 second = open(DOWN, STAKE);
        assertEq(first, BASE + 1);
        assertEq(second, BASE + 2);
        assertEq(reserve.ticketCount(), 2);
        assertEq(reserve.ticketOf(first).band, UP);
        assertEq(reserve.ticketOf(second).band, DOWN);
    }

    function test_noTicketAtOrBelowTheBase() public {
        open(UP, STAKE);
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.UnknownTicket.selector, BASE));
        reserve.ticketOf(BASE);
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.UnknownTicket.selector, 1));
        reserve.ticketOf(1);
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.UnknownTicket.selector, BASE + 2));
        reserve.ticketOf(BASE + 2);
    }

    function test_aShiftedTicketLivesItsWholeLife() public {
        uint256 up = open(UP, STAKE);
        fill(up, K);
        uint256 down = open(DOWN, STAKE);
        fill(down, K);
        uint64 half = reserve.ticketOf(up).payout / 2;
        vm.warp(block.timestamp + MIN_HOLD_SEC);
        closeShares(up, half);
        fill(up, K + 10e8);
        assertEq(reserve.ticketOf(up).status, TICKET_OPEN);
        settle(K + 100e8);
        claim(up);
        claim(down);
        assertEq(reserve.ticketOf(up).status, TICKET_SETTLED);
        assertEq(reserve.ticketOf(down).status, TICKET_SETTLED);
        assertEq(reserve.payableTotal(), 0);
        assertSolvent();
    }
}
