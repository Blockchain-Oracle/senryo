// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {PerpModule} from "../../src/core/PerpModule.sol";
import {Events} from "../../src/libraries/Events.sol";
import {Book} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {Fixture} from "../utils/Fixture.sol";
import {MockFeed} from "../utils/Mocks.sol";

/// @title D-181 — a voluntary decrease never socialises a loss that the account's other value must pay.
/// @notice Found while triaging the "unchecked `_settleLoss` return" findings (Wake, Aderyn). Before the fix a healthy
/// hedged account (long gold + short silver, both down ~30 %) closed the losing leg first: its loss beyond the balance
/// went to INSURANCE, then the winning leg was paid in full — the trader ended at 15.15 USD instead of 11.83 and the
/// house lost 3.20 USD. Funding/borrow were also charged ahead of a same-close profit, socialising fees the profit
/// covered. `_decrease` now settles PnL − funding − borrow as one net amount and reverts `LossExceedsBalance` while
/// any other position remains; a shortfall on the last position is still socialised (liquidation-equivalent).
contract DecreaseShortfallTest is Fixture {
    uint256 internal constant DEPOSIT_USD6 = 12e6;
    uint256 internal constant LEG_USD6 = 50e6;
    /// @dev 1.5 % per round stays inside the 2 % clamp; 24 rounds ≈ −30 %.
    int256 internal constant STEP_DOWN = 985;
    int256 internal constant STEP_UP = 1015;
    int256 internal constant STEP_DEN = 1000;
    uint256 internal constant CRASH_ROUNDS = 24;
    uint256 internal constant RALLY_ROUNDS = 7;
    /// @dev One-sided gold OI pays ~0.24 %/day funding: after 120 days fees exceed the 12 USD balance.
    uint256 internal constant FUNDING_DAYS = 120;

    address internal trader = makeAddr("trader");

    function setUp() public {
        _deploy(true, MONDAY + 12 * HOUR);
        _seedBooks();
        _depositFor(trader, ausd, DEPOSIT_USD6);
    }

    function test_loserFirstRevertsWhileAnotherPositionIsOpen() public {
        _open(S.GOLD_MARKET, true);
        _open(S.SILVER_MARKET, false);
        _move(CRASH_ROUNDS, STEP_DOWN);
        assertFalse(core.isLiquidatable(trader), "healthy hedged account");
        vm.prank(trader);
        vm.expectPartialRevert(PerpModule.LossExceedsBalance.selector);
        core.close(S.GOLD_MARKET, 0, _now());
    }

    function test_winnerFirstPaysTheLossInFull() public {
        _open(S.GOLD_MARKET, true);
        _open(S.SILVER_MARKET, false);
        _move(CRASH_ROUNDS, STEP_DOWN);
        uint256 house0 = _house();
        vm.startPrank(trader);
        core.close(S.SILVER_MARKET, type(uint256).max, _now());
        core.close(S.GOLD_MARKET, 0, _now());
        vm.stopPrank();
        assertGe(_house(), house0, "nothing socialised: the winner paid the loser");
        assertEq(core.account(trader).positionBitmap, 0, "flat");
    }

    function test_lastPositionShortfallIsStillSocialised() public {
        _open(S.GOLD_MARKET, true);
        _move(CRASH_ROUNDS, STEP_DOWN);
        vm.expectEmit(true, false, false, false, address(core));
        emit Events.InsuranceCovered(trader, 0, 0);
        vm.prank(trader);
        core.close(S.GOLD_MARKET, 0, _now());
        assertEq(_bal(), 0, "balance fully charged; the uncovered remainder is socialised, as a liquidation would");
    }

    function test_feesNetAgainstProfitBeforeAnyShortfall() public {
        _open(S.GOLD_MARKET, true);
        vm.warp(vm.getBlockTimestamp() + FUNDING_DAYS * DAY);
        _move(RALLY_ROUNDS, STEP_UP);
        uint256 house0 = _house();
        uint256 bal0 = _bal();
        vm.prank(trader);
        core.close(S.GOLD_MARKET, 0, _now());
        assertGe(_house(), house0, "owed fees above the profit are paid, not socialised");
        assertLt(_bal(), bal0, "the trader paid the net");
    }

    // ---------------------------------------------------------------- helpers

    function _open(uint8 marketId, bool isLong) internal {
        vm.prank(trader);
        core.increase(marketId, isLong, LEG_USD6, isLong ? type(uint256).max : 0, _now());
    }

    /// @dev Both feeds move together round by round (each accepted within the clamp), then past MIN_HOLD_BLOCKS.
    function _move(uint256 rounds, int256 stepNum) internal {
        for (uint256 i; i < rounds; ++i) {
            _step(xau, stepNum);
            _step(xag, stepNum);
            oracle.observe(S.GOLD_MARKET);
            oracle.observe(S.SILVER_MARKET);
        }
        vm.roll(vm.getBlockNumber() + C.MIN_HOLD_BLOCKS + 1);
    }

    function _step(MockFeed f, int256 stepNum) internal {
        (, int256 a,,,) = f.latestRoundData();
        f.push(a * stepNum / STEP_DEN);
    }

    function _now() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp());
    }

    function _bal() internal view returns (uint256) {
        return core.account(trader).ausd + core.account(trader).usdc;
    }

    function _house() internal view returns (uint256) {
        (uint256 pa, uint256 pu) = core.book(Book.POOL);
        (uint256 ia, uint256 iu) = core.book(Book.INSURANCE);
        return pa + pu + ia + iu;
    }
}
