// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {ExitOrders} from "../../src/markets/ExitOrders.sol";
import {SessionGrants} from "../../src/markets/SessionGrants.sol";
import {IBandReserve} from "../../src/markets/interfaces/IBandReserve.sol";
import {MarketsBase} from "./MarketsBase.t.sol";
import "../../src/markets/MarketTypes.sol";

/// @notice Exits that cash out with the app closed (D-292): the fill print's bid decides take-profit and stop-loss, the
///         keeper times the trail above the owner's floor, a miss leaves the exit standing, and closes no longer pin the
///         pricing config.
contract ExitsTest is MarketsBase {
    uint32 internal constant HALF_SPREAD = 20_000;
    uint32 internal constant TAKE_PROFIT = 750_000;
    uint32 internal constant STOP = 300_000;
    uint32 internal constant FLOOR = 100_000;
    address internal constant STRANGER = address(0xBEEF);

    function exitOrder(uint256 id, uint32 tp, uint32 sl, uint32 floor, uint32 trail)
        internal
        returns (ExitOrder memory o)
    {
        o = ExitOrder({
            owner: owner,
            ticketId: id,
            takeProfitE6: tp,
            stopLossE6: sl,
            floorE6: floor,
            trailE6: trail,
            deadline: uint64(vm.getBlockTimestamp() + 60), // via-IR caches block.timestamp across a warp
            nonce: nextNonce++,
            epoch: reserve.epochOf(owner)
        });
    }

    function signExit(uint256 pk, ExitOrder memory o) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, reserve.hashExit(o));
        return abi.encodePacked(r, s, v);
    }

    function setExit(uint256 id, uint32 tp, uint32 sl, uint32 floor, uint32 trail) internal {
        ExitOrder memory o = exitOrder(id, tp, sl, floor, trail);
        reserve.setExit(o, signExit(OWNER_PK, o));
    }

    /// @dev A filled Up call, held long enough to close.
    function heldUp() internal returns (uint256 id) {
        id = open(UP, STAKE);
        fill(id, K);
        vm.warp(reserve.ticketOf(id).filledAt + MIN_HOLD_SEC);
    }

    /// @dev Up's bid (probability − half-spread) at a print of `price` for instant `at`.
    function bidAt(int64 price, uint40 at) internal view returns (uint256) {
        (uint256 probE6,,) = reserve.quoteOpen(windowId, UP, STAKE, price, at);
        return probE6 - HALF_SPREAD;
    }

    function fireAsStranger(uint256 id) internal returns (uint40 target) {
        vm.prank(STRANGER);
        reserve.fireExit(id);
        target = reserve.ticketOf(id).target;
    }

    /// @dev Fills the fired exit at `price` and expects the miss (the exit stands).
    function miss(uint256 id, int64 price) internal {
        uint40 target = reserve.ticketOf(id).target;
        if (vm.getBlockTimestamp() <= target) vm.warp(target + 1);
        bytes memory proof = printAt(target, price);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint256 fee = pyth.FEE();
        vm.expectEmit(true, false, false, true, address(reserve));
        emit IBandReserve.CloseRefused(id, REFUSE_EXIT);
        reserve.finalize{value: fee}(target, ids, proof);
    }

    // ------------------------------------------------------------------------------------------------ prices decide

    function test_takeProfitFillsAtItsPriceAndNotBefore() public {
        uint256 id = heldUp();
        setExit(id, TAKE_PROFIT, 0, 0, 0);
        uint64 shares = reserve.ticketOf(id).payout;

        uint40 target = fireAsStranger(id);
        assertLt(bidAt(K + 30e8, target), TAKE_PROFIT, "not there yet");
        miss(id, K + 30e8);
        assertEq(reserve.ticketOf(id).payout, shares, "nothing sold");
        assertEq(reserve.exitOf(id).takeProfitE6, TAKE_PROFIT, "the exit stands");
        assertEq(reserve.exitOf(id).firing, EXIT_NONE);

        target = fireAsStranger(id);
        uint256 bid = bidAt(K + 90e8, target);
        assertGe(bid, TAKE_PROFIT, "reached");
        uint256 before = usd.balanceOf(owner);
        fill(id, K + 90e8);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED);
        assertEq(usd.balanceOf(owner) - before, uint256(shares) * bid / P_ONE, "every share at the print's bid");
        assertEq(reserve.exitOf(id).takeProfitE6, 0, "cleared once closed");
        assertSolvent();
    }

    function test_stopLossFillsBetweenItsFloorAndItsStop() public {
        uint256 id = heldUp();
        setExit(id, 0, STOP, FLOOR, 0);

        uint40 target = fireAsStranger(id);
        assertGt(bidAt(K, target), STOP, "above the stop: too early");
        miss(id, K);

        target = fireAsStranger(id);
        uint256 crashed = bidAt(K - 120e8, target);
        assertLt(crashed, FLOOR, "through the floor");
        assertGe(crashed + HALF_SPREAD, params().minProbE6, "still priced");
        miss(id, K - 120e8);
        assertEq(reserve.ticketOf(id).status, TICKET_OPEN, "never sold below the floor");

        target = fireAsStranger(id);
        uint256 bid = bidAt(K - 60e8, target);
        assertTrue(bid >= FLOOR && bid <= STOP, "inside the stop");
        fill(id, K - 60e8);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED);
        assertSolvent();
    }

    function test_trailIsTheExitKeepersAloneAndKeepsTheFloor() public {
        uint256 id = heldUp();
        setExit(id, 0, 0, 400_000, FLOOR);

        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, STRANGER));
        reserve.fireTrail(id);
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(ExitOrders.NoExit.selector, id));
        reserve.fireExit(id);

        reserve.fireTrail(id); // this test holds the admin role, as the keeper holds the exit role
        assertLt(bidAt(K - 60e8, reserve.ticketOf(id).target), 400_000);
        miss(id, K - 60e8);

        reserve.fireTrail(id);
        fill(id, K);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED);
        assertSolvent();
    }

    // ------------------------------------------------------------------------------------------------ who and when

    function test_aOneTapExitOutlivesTheSession() public {
        grant(25e6, 60e6, uint40(block.timestamp + 60));
        uint256 id = heldUp();
        ExitOrder memory o = exitOrder(id, TAKE_PROFIT, 0, 0, 0);
        reserve.setExit(o, signExit(DELEGATE_PK, o));

        vm.warp(T0 + 100); // the session is over
        o = exitOrder(id, TAKE_PROFIT + 1, 0, 0, 0);
        bytes memory late = signExit(DELEGATE_PK, o);
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.SessionExpired.selector, owner));
        reserve.setExit(o, late);

        fireAsStranger(id);
        fill(id, K + 90e8);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED, "fired with the app closed");
        assertSolvent();
    }

    function test_aRevokeCancelsTheExit() public {
        uint256 id = heldUp();
        setExit(id, TAKE_PROFIT, STOP, 0, 0);
        vm.prank(owner);
        reserve.bumpEpoch();
        vm.expectRevert(abi.encodeWithSelector(ExitOrders.ExitRevoked.selector, id));
        reserve.fireExit(id);
    }

    function test_theOwnersCashOutReplacesAFiredExitAndTheExitKeepsTheRest() public {
        uint256 id = heldUp();
        setExit(id, TAKE_PROFIT, STOP, 0, 0);
        uint64 shares = reserve.ticketOf(id).payout;

        fireAsStranger(id); // a fired exit never blocks the owner's own cash-out
        closeShares(id, shares / 2);
        fill(id, K);
        uint64 rest = reserve.ticketOf(id).payout;
        assertEq(rest, shares - shares / 2, "the owner's half sold");
        assertEq(reserve.exitOf(id).stopLossE6, STOP, "the exit stands for the rest");

        fireAsStranger(id);
        assertEq(reserve.ticketOf(id).closing, rest, "the exit sells what remains");
        fill(id, K + 90e8);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED);
        assertSolvent();
    }

    function test_closesNoLongerPinTheConfig() public {
        uint256 id = heldUp();
        uint64 shares = reserve.ticketOf(id).payout;
        Intent memory it = intent(ACTION_CLOSE, 0, id, shares / 2, 0);
        bytes memory sig = sign(OWNER_PK, it);
        reserve.setSigma(seriesId, SIGMA + 1); // a listing run reprices every series
        reserve.commit(it, sig, noPermit());
        fill(id, K);
        assertEq(reserve.ticketOf(id).payout, shares - shares / 2, "a close signed before the change still fills");

        setExit(id, 0, 600_000, 0, 0);
        reserve.setSigma(seriesId, SIGMA + 2);
        fireAsStranger(id);
        fill(id, K);
        assertEq(reserve.ticketOf(id).status, TICKET_CLOSED, "so does an exit");
        assertSolvent();
    }

    function test_badExitsAreRefused() public {
        uint256 id = open(UP, STAKE);
        setExit(id, TAKE_PROFIT, 0, 0, 0); // a committed call may carry its exit from the start
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.TicketNotOpen.selector, id, TICKET_COMMITTED));
        reserve.fireExit(id);
        fill(id, K);

        ExitOrder memory o = exitOrder(id, 0, STOP, STOP + 1, 0); // floor above the stop
        bytes memory sig = signExit(OWNER_PK, o);
        vm.expectRevert(ExitOrders.BadExit.selector);
        reserve.setExit(o, sig);

        o = exitOrder(id, STOP, STOP, 0, 0); // take-profit not above the stop
        sig = signExit(OWNER_PK, o);
        vm.expectRevert(ExitOrders.BadExit.selector);
        reserve.setExit(o, sig);

        o = exitOrder(id, uint32(P_ONE), 0, 0, 0); // a share never bids $1
        sig = signExit(OWNER_PK, o);
        vm.expectRevert(ExitOrders.BadExit.selector);
        reserve.setExit(o, sig);

        o = exitOrder(id, TAKE_PROFIT, 0, 0, 0);
        sig = signExit(0x5157, o);
        vm.expectRevert(SessionGrants.SignatureInvalid.selector);
        reserve.setExit(o, sig);

        o.owner = STRANGER;
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.NotTicketOwner.selector, id, STRANGER));
        reserve.setExit(o, sig);
    }
}
