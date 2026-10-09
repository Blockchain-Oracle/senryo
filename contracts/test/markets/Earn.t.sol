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

    function signed(uint8 kind, uint256 amount, uint256 nonce, uint256 pk)
        internal
        view
        returns (PoolShares.EarnRequest memory r, bytes memory sig)
    {
        r = PoolShares.EarnRequest(kind, owner, amount, uint64(block.timestamp + 60), nonce);
        bytes32 structHash =
            keccak256(abi.encode(shares.EARN_REQUEST_TYPEHASH(), r.kind, r.owner, r.amount, r.deadline, r.nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", shares.domainSeparator(), structHash));
        (uint8 v, bytes32 rs, bytes32 ss) = vm.sign(pk, digest);
        sig = abi.encodePacked(rs, ss, v);
    }

    function test_aSignedSupplyIsRelayedWithoutTheOwnersGas() public {
        vm.prank(owner);
        usd.approve(address(shares), SUPPLY);
        (PoolShares.EarnRequest memory r, bytes memory sig) = signed(shares.SUPPLY(), SUPPLY, 1, OWNER_PK);
        shares.requestFor(r, sig, noPermit()); // sent by this contract, signed by the owner
        (, uint256 amount) = shares.supplyOf(owner);
        assertEq(amount, SUPPLY);
        vm.expectRevert(abi.encodeWithSelector(PoolShares.NonceUsed.selector, owner, 1));
        shares.requestFor(r, sig, noPermit());
    }

    function test_onlyTheOwnersSignatureCounts() public {
        (PoolShares.EarnRequest memory r, bytes memory sig) = signed(shares.SUPPLY(), SUPPLY, 2, DELEGATE_PK);
        vm.expectRevert(PoolShares.SignatureInvalid.selector);
        shares.requestFor(r, sig, noPermit());
    }

    function test_aSignedWithdrawalEscrowsTheOwnersShares() public {
        shares.transfer(owner, SUPPLY);
        (PoolShares.EarnRequest memory r, bytes memory sig) = signed(shares.WITHDRAW(), SUPPLY, 3, OWNER_PK);
        shares.requestFor(r, sig, noPermit());
        assertEq(shares.balanceOf(owner), 0);
        shares.roll(T0);
        shares.claim(owner);
        assertEq(usd.balanceOf(owner), WALLET + SUPPLY, "paid at the pool's price (1)");
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
