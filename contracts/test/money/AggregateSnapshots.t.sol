// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {PerpMath} from "../../src/libraries/PerpMath.sol";
import {MarketState, Position} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {Fixture} from "../utils/Fixture.sol";

/// @title D-182 — market aggregates are removed with the snapshots they were added with.
/// @notice Before the fix `_increase`/`_decrease` re-snapped the position's funding/borrow indexes and then removed its
/// aggregate with the NEW snapshots: `borrowSnapSum` (uint) underflowed, so the only position in a market could not
/// be closed or increased once any time had passed, and with several positions the snapshot sums (→ LP
/// `poolValue` receivables) drifted. Checked here: a close after time passes, and Σ over positions == aggregates.
contract AggregateSnapshotsTest is Fixture {
    uint256 internal constant DEPOSIT_USD6 = 40e6;
    uint256 internal constant LEG_USD6 = 20e6;
    uint256 internal constant ADD_USD6 = 10e6;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        _deploy(true, MONDAY + 12 * HOUR);
        _seedBooks();
        _depositFor(alice, ausd, DEPOSIT_USD6);
        _depositFor(bob, ausd, DEPOSIT_USD6);
    }

    function test_onlyPositionClosesAfterTimePasses() public {
        _increase(alice, true, LEG_USD6);
        _later(HOUR);
        vm.prank(alice);
        core.close(S.GOLD_MARKET, 0, _now());
        MarketState memory s = core.marketState(S.GOLD_MARKET);
        assertEq(s.longSize, 0, "size");
        assertEq(s.longNotional, 0, "notional");
        assertEq(s.longEntry18, 0, "entry");
        assertEq(s.longFundingSnapSum, 0, "funding snapshots");
        assertEq(s.borrowSnapSum, 0, "borrow snapshots");
    }

    function test_aggregatesEqualSumOfPositionsOverTime() public {
        _increase(alice, true, LEG_USD6);
        _later(HOUR);
        _increase(bob, false, LEG_USD6);
        _later(HOUR);
        _increase(alice, true, ADD_USD6);
        _later(HOUR);
        Position memory p = core.position(bob, S.GOLD_MARKET);
        vm.prank(bob);
        core.decrease(S.GOLD_MARKET, p.size / 2, type(uint256).max, _now());
        _later(HOUR);
        _assertAggregates();
    }

    // ---------------------------------------------------------------- helpers

    function _assertAggregates() internal view {
        Position memory a = core.position(alice, S.GOLD_MARKET);
        Position memory b = core.position(bob, S.GOLD_MARKET);
        MarketState memory s = core.marketState(S.GOLD_MARKET);
        uint256 na = PerpMath.notional(a.size, a.entry);
        uint256 nb = PerpMath.notional(b.size, b.entry);
        assertEq(s.longSize, a.size, "long size");
        assertEq(s.shortSize, b.size, "short size");
        assertEq(s.longNotional, na, "long notional");
        assertEq(s.shortNotional, nb, "short notional");
        assertEq(s.longFundingSnapSum, int256(na) * a.fundingSnap, "long funding snapshots");
        assertEq(s.shortFundingSnapSum, int256(nb) * b.fundingSnap, "short funding snapshots");
        assertEq(s.borrowSnapSum, na * a.borrowSnap + nb * b.borrowSnap, "borrow snapshots");
    }

    function _increase(address user, bool isLong, uint256 notional) internal {
        vm.prank(user);
        core.increase(S.GOLD_MARKET, isLong, notional, isLong ? type(uint256).max : 0, _now());
    }

    /// @dev Time passes with a fresh (unchanged) round so the market stays OPEN and borrow/funding accrue.
    function _later(uint256 dt) internal {
        vm.warp(vm.getBlockTimestamp() + dt);
        vm.roll(vm.getBlockNumber() + C.MIN_HOLD_BLOCKS + 1);
        (, int256 answer,,,) = xau.latestRoundData();
        xau.push(answer);
        oracle.observe(S.GOLD_MARKET);
    }

    function _now() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp());
    }
}
