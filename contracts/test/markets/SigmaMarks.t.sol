// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {SigmaMarks} from "../../src/markets/SigmaMarks.sol";
import "../../src/markets/MarketTypes.sol";
import {MarketsBase} from "./MarketsBase.t.sol";

/// @notice D-300: a fill carries exactly one mark — its feed's, for the last minute boundary five seconds or more
///         before it, signed by an allowed key — and σ is held inside the series' bounds whatever the mark says.
contract SigmaMarksTest is MarketsBase {
    uint256 internal constant STRANGER_PK = 0xBAD;

    function test_theMarkMinuteIsTheLastBoundaryFiveSecondsBack() public view {
        assertEq(reserve.markMinuteOf(T0 + 5), T0);
        assertEq(reserve.markMinuteOf(T0 + 4), T0 - SIGMA_MARK_STEP_SEC);
        assertEq(reserve.markMinuteOf(T0 + 64), T0);
        assertEq(reserve.markMinuteOf(T0 + 65), T0 + SIGMA_MARK_STEP_SEC);
    }

    function test_onlyTheRightMarkFills() public {
        uint256 id = open(UP, STAKE);
        uint40 target = reserve.ticketOf(id).target;
        vm.warp(target + 1);
        bytes memory proof = printAt(target, K);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        (SigmaMark memory good,) = markOf(BTC_FEED, target);

        SigmaMark[5] memory bad = [
            SigmaMark(BTC_FEED, good.minute - SIGMA_MARK_STEP_SEC, SIGMA, SIGMA), // an older minute: no picking
            SigmaMark(BTC_FEED, good.minute + SIGMA_MARK_STEP_SEC, SIGMA, SIGMA), // a later minute: no look-ahead
            SigmaMark(keccak256("ETH/USD"), good.minute, SIGMA, SIGMA), // another feed's
            SigmaMark(BTC_FEED, good.minute, 0, SIGMA), // no σ
            SigmaMark(BTC_FEED, good.minute, SIGMA, 0)
        ];
        uint256 fee = pyth.FEE();
        for (uint256 i; i < bad.length; ++i) {
            bytes memory sig = signMark(SIGNER_PK, bad[i]);
            vm.expectRevert(abi.encodeWithSelector(SigmaMarks.BadSigmaMark.selector, bad[i].feedId, bad[i].minute));
            reserve.finalize{value: fee}(target, ids, proof, bad[i], sig);
        }
        bytes memory forged = signMark(STRANGER_PK, good);
        vm.expectRevert(abi.encodeWithSelector(SigmaMarks.BadSigmaMark.selector, BTC_FEED, good.minute));
        reserve.finalize{value: fee}(target, ids, proof, good, forged);

        reserve.setSigmaSigner(vm.addr(SIGNER_PK), false);
        bytes memory revoked = signMark(SIGNER_PK, good);
        vm.expectRevert(abi.encodeWithSelector(SigmaMarks.BadSigmaMark.selector, BTC_FEED, good.minute));
        reserve.finalize{value: fee}(target, ids, proof, good, revoked);
        assertEq(reserve.ticketOf(id).status, TICKET_COMMITTED, "nothing moved");

        reserve.setSigmaSigner(vm.addr(SIGNER_PK), true);
        finalizeOn(BTC_FEED, fee, target, ids, proof);
        assertEq(reserve.ticketOf(id).status, TICKET_OPEN);
        assertSolvent();
    }

    /// @dev A mark outside the series' bounds prices exactly as the bound does: a bad or compromised signer moves σ
    ///      only inside what the admin listed.
    function test_aMarkIsHeldInsideTheSeriesBounds() public view {
        uint40 at = T0 + 60;
        int64 spot = K + 30e8;
        (SigmaMark memory m,) = markOf(BTC_FEED, at);
        SigmaMark memory wild = SigmaMark(BTC_FEED, m.minute, SIGMA * 100, SIGMA * 100);
        SigmaMark memory cap = SigmaMark(BTC_FEED, m.minute, SIGMA * 2, SIGMA * 2);
        SigmaMark memory tiny = SigmaMark(BTC_FEED, m.minute, 1, 1);
        SigmaMark memory floor = SigmaMark(BTC_FEED, m.minute, SIGMA / 2, SIGMA / 2);
        (uint256 pWild,,) = reserve.quoteOpen(windowId, UP, STAKE, spot, at, wild);
        (uint256 pCap,,) = reserve.quoteOpen(windowId, UP, STAKE, spot, at, cap);
        (uint256 pTiny,,) = reserve.quoteOpen(windowId, UP, STAKE, spot, at, tiny);
        (uint256 pFloor,,) = reserve.quoteOpen(windowId, UP, STAKE, spot, at, floor);
        assertEq(pWild, pCap);
        assertEq(pTiny, pFloor);
        assertGt(pFloor, pCap, "a calmer sigma makes the leader likelier");
    }

    function test_onlyTheAdminAllowsSigners() public {
        vm.prank(owner);
        vm.expectRevert();
        reserve.setSigmaSigner(owner, true);
    }
}
