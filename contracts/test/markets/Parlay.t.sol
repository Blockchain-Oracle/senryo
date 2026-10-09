// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {BandMath} from "../../src/markets/BandMath.sol";
import {ParlayBook} from "../../src/markets/ParlayBook.sol";
import {ParlayMath} from "../../src/markets/ParlayMath.sol";
import {SessionGrants} from "../../src/markets/SessionGrants.sol";
import {IBandReserve} from "../../src/markets/interfaces/IBandReserve.sol";
import {MarketsBase} from "./MarketsBase.t.sol";
import "../../src/markets/MarketTypes.sol";

/// @notice Parlays (D-293): every leg priced at the unique print of the fill instant, the joint chance with the
///         class floor, the spread once; locks per expiry released as legs are decided in close order; a lost leg ends
///         it, a tie drops out, a void refunds; the pool stays solvent throughout.
contract ParlayTest is MarketsBase {
    bytes32 internal constant ETH = bytes32("ETH");
    bytes32 internal constant ETH_FEED = keccak256("ETH/USD");
    int64 internal constant KE = 3000e8;
    uint32 internal constant ETH_CADENCE = 60;
    uint256 internal constant EXTRA_FEE = 5;

    bytes32 internal ethSeries;
    bytes32 internal ethWindow;

    receive() external payable {}

    function setUp() public override {
        super.setUp();
        PolicyVersion memory v0;
        v0.validUntil = OPEN_ENDED;
        v0.primary = PrintSource(address(verifier), ETH_FEED);
        ethSeries = windows.registerSeries(ETH, ETH_CADENCE, 0, v0);
        reserve.setSigma(ethSeries, SIGMA);
        reserve.addBand(ethSeries, BandDef(BAND_UP, 0, 0));
        reserve.addBand(ethSeries, BandDef(BAND_DOWN, 0, 0));
        ethWindow = windows.openWindow(ethSeries, T0);
        recordEth(T0, KE);
    }

    function recordEth(uint40 t, int64 price) internal {
        bytes memory proof = pyth.push(ETH_FEED, t, t - 1, price, CONF, EXPO);
        windows.recordPrint{value: pyth.FEE()}(address(verifier), ETH_FEED, t, proof);
    }

    /// @dev ETH (closes first) then BTC — close order.
    function parlayIntent(uint8 ethBand, uint8 btcBand, uint64 stake) internal returns (ParlayIntent memory it) {
        bytes32[] memory ids = new bytes32[](2);
        (ids[0], ids[1]) = (ethWindow, windowId);
        uint8[] memory bands = new uint8[](2);
        (bands[0], bands[1]) = (ethBand, btcBand);
        it = ParlayIntent({
            owner: owner,
            windowIds: ids,
            bands: bands,
            stake: stake,
            minPayout: 0,
            recipient: owner,
            configVersion: reserve.configVersion(),
            deadline: uint64(vm.getBlockTimestamp() + 60),
            nonce: nextNonce++,
            epoch: reserve.epochOf(owner)
        });
    }

    function signParlay(uint256 pk, ParlayIntent memory it) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, reserve.hashParlay(it));
        return abi.encodePacked(r, s, v);
    }

    function commit(ParlayIntent memory it) internal returns (uint256) {
        return reserve.commitParlay(it, signParlay(OWNER_PK, it), noPermit());
    }

    function fillParlay(uint256 id, int64 ethPrice, int64 btcPrice) internal {
        fillParlay(id, ethPrice, btcPrice, 0);
    }

    /// @dev Fills at ETH and BTC prints of the target, sending a little more than the fees (the rest comes back);
    ///      `refusal` != 0 expects that refusal instead (a refusal before pricing records no print and spends nothing).
    function fillParlay(uint256 id, int64 ethPrice, int64 btcPrice, uint8 refusal) internal {
        (Parlay memory pl,) = reserve.parlayOf(id);
        if (vm.getBlockTimestamp() <= pl.target) vm.warp(pl.target + 1);
        bytes[] memory proofs = new bytes[](2);
        proofs[0] = pyth.push(ETH_FEED, pl.target, pl.target - 1, ethPrice, CONF, EXPO);
        proofs[1] = printAt(pl.target, btcPrice);
        uint256 fee = refusal == 0 || refusal == REFUSE_PRICE ? 2 * pyth.FEE() : 0;
        uint256 before = address(this).balance;
        if (refusal != 0) {
            vm.expectEmit(true, false, false, true, address(reserve));
            emit ParlayBook.ParlayRefused(id, refusal, pl.stake);
        }
        reserve.finalizeParlay{value: fee + EXTRA_FEE}(id, proofs);
        assertEq(before - address(this).balance, fee, "only the fees are kept");
    }

    function closeEth(int64 price) internal {
        vm.warp(T0 + ETH_CADENCE + 1);
        recordEth(T0 + ETH_CADENCE, price);
        windows.resolve(ethWindow);
    }

    function closeBtc(int64 price) internal {
        vm.warp(T0 + CADENCE + 1);
        record(T0 + CADENCE, price);
        windows.resolve(windowId);
    }

    function filled(uint256 id) internal view returns (Parlay memory pl, ParlayLeg[] memory legs) {
        (pl, legs) = reserve.parlayOf(id);
        assertEq(pl.status, TICKET_OPEN, "filled");
    }

    // ------------------------------------------------------------------------------------------------ pricing

    function test_theJointChanceFloorsCorrelatedLegsAndMultipliesTheRest() public pure {
        uint256[] memory probs = new uint256[](3);
        (probs[0], probs[1], probs[2]) = (500_000, 500_000, 400_000);
        uint8[] memory groups = new uint8[](3);
        (groups[0], groups[1], groups[2]) = (0, 0, 2);
        // Two crypto coins at even odds move together: 85 % of the least likely, not a quarter; gold multiplies.
        assertEq(ParlayMath.chanceE6(probs, groups), 425_000 * 400_000 / P_ONE);
        groups[1] = 1;
        assertEq(ParlayMath.chanceE6(probs, groups), 100_000, "three classes: the plain product");
        probs[1] = 0; // a dropped leg is skipped
        assertEq(ParlayMath.chanceE6(probs, groups), 200_000);
    }

    function test_aParlayFillsOnEveryLegsPrintAndPaysWhenAllWin() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        assertEq(reserve.committedStakes(), STAKE);
        fillParlay(id, KE, K);
        (Parlay memory pl, ParlayLeg[] memory legs) = filled(id);
        uint256 chance = ParlayMath.chanceE6(_probs(legs), _groups(legs));
        assertEq(pl.payout, BandMath.payoutFor(STAKE, chance + pl.addOnE6), "the joint chance plus the spread, once");
        assertGt(pl.payout, 2 * STAKE, "two calls pay more than one");
        assertSolvent();

        closeEth(KE + 1e8);
        reserve.settleParlay(id);
        closeBtc(K + 10e8);
        uint256 before = usd.balanceOf(owner);
        reserve.settleParlay(id);
        assertEq(usd.balanceOf(owner) - before, pl.payout, "the whole payout");
        assertEq(reserve.reserved(), 0);
        assertEq(reserve.escrowedStakes(), 0);
        assertSolvent();
    }

    function test_eachExpiryIsLockedUntilItsLegIsDecided() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        fillParlay(id, KE, K);
        (Parlay memory pl,) = filled(id);
        uint256 reserve_ = pl.payout - pl.stake;
        assertEq(reserve.reservedByExpiry(T0 + ETH_CADENCE), reserve_, "Earn's roll waits for the ETH leg");
        assertEq(reserve.reservedByExpiry(T0 + CADENCE), reserve_, "and for the BTC leg");
        assertEq(reserve.reserved(), reserve_, "counted once in the pool");

        closeEth(KE + 1e8);
        reserve.settleParlay(id);
        assertEq(reserve.reservedByExpiry(T0 + ETH_CADENCE), 0, "the ETH hour can roll");
        assertEq(reserve.reservedByExpiry(T0 + CADENCE), reserve_);
        (, ParlayLeg[] memory legs) = reserve.parlayOf(id);
        assertEq(legs[0].outcome, LEG_WON);
        assertEq(legs[1].outcome, LEG_PENDING);
    }

    function test_aLostLegEndsItAtOnceAndTheEscrowIsThePools() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        fillParlay(id, KE, K);
        (Parlay memory pl,) = filled(id);
        uint256 liquidBefore = reserve.liquid();
        closeEth(KE - 1e8);
        reserve.settleParlay(id); // the BTC window is still running
        (Parlay memory done,) = reserve.parlayOf(id);
        assertEq(done.status, TICKET_SETTLED);
        assertEq(reserve.liquid() - liquidBefore, pl.payout, "stake and reserve back to the pool");
        assertEq(reserve.reservedByExpiry(T0 + CADENCE), 0, "every lock released");
        assertSolvent();
    }

    function test_aTiedLegDropsOutAndPaysOnTheOthersOdds() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        fillParlay(id, KE, K);
        (Parlay memory pl, ParlayLeg[] memory legs) = filled(id);
        closeEth(KE); // exactly at the line: a tie
        closeBtc(K + 10e8);
        uint256 before = usd.balanceOf(owner);
        reserve.settleParlay(id);
        uint256 alone = BandMath.payoutFor(STAKE, uint256(legs[1].probE6) + pl.addOnE6);
        assertEq(usd.balanceOf(owner) - before, alone, "BTC's odds alone");
        assertLt(alone, pl.payout);
        assertSolvent();
    }

    function test_aVoidLegRefundsTheStake() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        fillParlay(id, KE, K);
        vm.warp(T0 + ETH_CADENCE + ADMISSION + 1); // the ETH close print never came
        windows.voidExpired(ethWindow);
        uint256 before = usd.balanceOf(owner);
        reserve.settleParlay(id);
        assertEq(usd.balanceOf(owner) - before, STAKE, "the stake back");
        assertEq(reserve.reserved(), 0);
        assertSolvent();
    }

    // ------------------------------------------------------------------------------------------------ refusals

    function test_legsAreTwoToFourInCloseOrderOnePerMarket() public {
        ParlayIntent memory it = parlayIntent(UP, UP, STAKE);
        (it.windowIds[0], it.windowIds[1]) = (windowId, ethWindow); // BTC closes after ETH
        bytes memory sig = signParlay(OWNER_PK, it);
        vm.expectRevert(ParlayBook.BadLegs.selector);
        reserve.commitParlay(it, sig, noPermit());

        it = parlayIntent(UP, DOWN, STAKE);
        it.windowIds[0] = windowId; // BTC twice
        sig = signParlay(OWNER_PK, it);
        vm.expectRevert(ParlayBook.BadLegs.selector);
        reserve.commitParlay(it, sig, noPermit());

        it = parlayIntent(UP, UP, STAKE);
        it.bands = new uint8[](1);
        sig = signParlay(OWNER_PK, it);
        vm.expectRevert(ParlayBook.BadLegs.selector);
        reserve.commitParlay(it, sig, noPermit());
    }

    function test_aLegOutsideThePricedBandRefundsAtTheFill() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        uint256 before = usd.balanceOf(owner);
        fillParlay(id, KE, K - 400e8, REFUSE_PRICE); // BTC far below its line: Up is near zero
        assertEq(usd.balanceOf(owner) - before, STAKE);
        assertEq(reserve.committedStakes(), 0);
        assertSolvent();
    }

    function test_noPrintMeansARefund() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        (Parlay memory pl,) = reserve.parlayOf(id);
        reserve.expireParlay(id); // still printable: nothing happens
        (pl,) = reserve.parlayOf(id);
        assertEq(pl.status, TICKET_COMMITTED);
        vm.warp(pl.target + ADMISSION + 1);
        reserve.expireParlay(id);
        (pl,) = reserve.parlayOf(id);
        assertEq(pl.status, TICKET_REFUNDED);
        assertSolvent();
    }

    function test_aOneTapParlaySpendsTheSessionsCaps() public {
        grant(STAKE, STAKE, uint40(vm.getBlockTimestamp() + 600));
        ParlayIntent memory it = parlayIntent(UP, UP, STAKE);
        reserve.commitParlay(it, signParlay(DELEGATE_PK, it), noPermit());
        it = parlayIntent(UP, UP, STAKE);
        bytes memory sig = signParlay(DELEGATE_PK, it);
        vm.expectRevert(abi.encodeWithSelector(SessionGrants.OverSessionCap.selector, 2 * STAKE, STAKE));
        reserve.commitParlay(it, sig, noPermit());
    }

    function test_aStaleConfigIsRefusedAtTheFill() public {
        uint256 id = commit(parlayIntent(UP, UP, STAKE));
        reserve.setSigma(seriesId, SIGMA + 1);
        fillParlay(id, KE, K, REFUSE_CONFIG);
        vm.expectRevert(abi.encodeWithSelector(ParlayBook.ParlayNotPending.selector, id));
        reserve.settleParlay(id);
        ParlayIntent memory it = parlayIntent(UP, UP, STAKE);
        it.configVersion = 0;
        bytes memory sig = signParlay(OWNER_PK, it);
        uint32 current = reserve.configVersion();
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.WrongConfig.selector, current, 0));
        reserve.commitParlay(it, sig, noPermit());
    }

    function _probs(ParlayLeg[] memory legs) private pure returns (uint256[] memory p) {
        p = new uint256[](legs.length);
        for (uint256 i; i < legs.length; ++i) {
            p[i] = legs[i].probE6;
        }
    }

    function _groups(ParlayLeg[] memory legs) private pure returns (uint8[] memory g) {
        g = new uint8[](legs.length);
        for (uint256 i; i < legs.length; ++i) {
            g[i] = legs[i].group;
        }
    }
}
