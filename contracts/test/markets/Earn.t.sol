// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {ISharedPool, PoolShares} from "../../src/markets/PoolShares.sol";
import "../../src/markets/MarketTypes.sol";
import {MarketsBase} from "./MarketsBase.t.sol";

/// @notice Earn (D-287): the house as the first shares, supply and withdraw at settled hours, the shares' price.
contract EarnTest is MarketsBase {
    uint64 internal constant POOL_ROLE = 3;
    uint256 internal constant SUPPLY = 1_000e6;
    uint40 internal constant HOUR = 3600;

    PoolShares internal shares;
    address internal supplier = makeAddr("supplier");

    function setUp() public override {
        super.setUp();
        shares = new PoolShares(address(manager), ISharedPool(address(reserve)));
        bytes4[] memory doors = new bytes4[](2);
        doors[0] = reserve.fund.selector;
        doors[1] = reserve.defund.selector;
        manager.setTargetFunctionRole(address(reserve), doors, POOL_ROLE);
        manager.grantRole(POOL_ROLE, address(shares), 0);
        shares.seed(address(this));
        usd.mint(supplier, SUPPLY);
        vm.prank(supplier);
        usd.approve(address(shares), type(uint256).max);
    }

    function supply(uint256 assets) internal {
        vm.prank(supplier);
        shares.requestSupply(assets);
    }

    function test_theHouseIsTheFirstShares() public {
        assertEq(shares.totalSupply(), POOL);
        assertEq(shares.poolValue(), POOL);
        vm.expectRevert(PoolShares.AlreadySeeded.selector);
        shares.seed(address(this));
    }

    function test_onlyTheSharesMoveThePoolsMoney() public {
        vm.expectRevert();
        reserve.fund(1);
    }

    function test_aSupplyBecomesSharesAtTheRollsPrice() public {
        supply(SUPPLY);
        assertEq(usd.balanceOf(supplier), 0);
        shares.roll(T0);
        shares.claim(supplier);
        assertEq(shares.balanceOf(supplier), SUPPLY, "price 1 while value == supply");
        assertEq(shares.poolValue(), POOL + SUPPLY, "the supply joined the pool");
    }

    function test_theRollWaitsForTheHoursWindows() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        vm.warp(T0 + HOUR);
        vm.expectRevert(abi.encodeWithSelector(PoolShares.HourNotSettled.selector, T0 + CADENCE));
        shares.roll(T0 + HOUR);
        settle(K - 100e8);
        vm.warp(T0 + HOUR);
        shares.roll(T0 + HOUR);
        assertEq(shares.lastRoll(), T0 + HOUR);
    }

    function test_suppliersShareWhatTheirPoolKeeps() public {
        supply(SUPPLY);
        shares.roll(T0);
        shares.claim(supplier);
        uint256 id = open(UP, STAKE);
        fill(id, K);
        uint256 before = shares.poolValue();
        settle(K - 100e8); // Up loses: the pool keeps the stake
        assertEq(shares.poolValue(), before + STAKE, "the loser's stake is the pool's");
        uint256 mine = shares.balanceOf(supplier);
        vm.prank(supplier);
        shares.requestWithdraw(mine);
        vm.warp(T0 + HOUR);
        uint256 valueBefore = shares.poolValue();
        shares.roll(T0 + HOUR);
        shares.claim(supplier);
        uint256 paid = usd.balanceOf(supplier);
        assertGt(paid, SUPPLY, "a supplier's slice of the kept stake");
        assertEq(shares.poolValue(), valueBefore - paid, "value leaves only as the withdrawal");
    }

    function test_aWithdrawalTheLiquidCannotCoverWaitsWhole() public {
        uint256 id = open(UP, STAKE); // reserved in the hour after T0
        fill(id, K);
        uint256 all = shares.balanceOf(address(this));
        shares.requestWithdraw(all);
        shares.roll(T0);
        assertEq(shares.openWithdrawBatch(), 0, "deferred: the batch is still open");
        assertEq(shares.balanceOf(address(shares)), all, "its shares wait in escrow");
        settle(K + 100e8); // Up wins: everything reserved is paid out or released
        vm.warp(T0 + HOUR);
        shares.roll(T0 + HOUR);
        assertEq(shares.openWithdrawBatch(), 1, "paid at the next roll");
        assertEq(shares.totalSupply(), 0);
    }

    function test_aRequestCanBeTakenBackUntilItsRoll() public {
        supply(SUPPLY);
        vm.prank(supplier);
        shares.cancel(true);
        assertEq(usd.balanceOf(supplier), SUPPLY);
        supply(SUPPLY);
        shares.roll(T0);
        vm.prank(supplier);
        vm.expectRevert(PoolShares.Settled.selector);
        shares.cancel(true);
    }
}
