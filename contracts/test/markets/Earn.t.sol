// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {ISharedPool, PoolShares} from "../../src/markets/PoolShares.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {RidesBase} from "./RidesBase.t.sol";

/// @notice Earn (D-287, v3 D-307): the house as the first shares; requests keyed by the hour they settle at, so nobody
///         joins or leaves knowing anything past it; open rides marked exactly at the roll; a deferred withdrawal holds
///         its liquidity from new risk.
contract EarnTest is RidesBase {
    uint64 internal constant POOL_ROLE = 3;
    uint256 internal constant SUPPLY = 1000e6;
    uint40 internal constant HOUR = 3600;
    uint40 internal constant H1 = T0 + HOUR;
    uint40 internal constant H2 = T0 + 2 * HOUR;

    PoolShares internal shares;
    address internal supplier = makeAddr("supplier");

    function setUp() public override {
        super.setUp();
        shares = new PoolShares(address(manager), ISharedPool(address(reserve)));
        bytes4[] memory doors = new bytes4[](3);
        doors[0] = reserve.fund.selector;
        doors[1] = reserve.defund.selector;
        doors[2] = reserve.setWithdrawHold.selector;
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

    /// @dev Opens the 5-minute window starting at `start` with its open print at K (calls then name it).
    function windowAt(uint40 start) internal {
        if (vm.getBlockTimestamp() < start) vm.warp(start);
        windowId = windows.openWindow(seriesId, start);
        vm.warp(start + 1);
        record(start, K);
    }

    function settleAt(uint40 start, int64 closePrice) internal {
        vm.warp(start + CADENCE + 1);
        record(start + CADENCE, closePrice);
        windows.resolve(windowId);
        reserve.settleWindow(windowId);
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
        vm.expectRevert();
        reserve.setWithdrawHold(1);
    }

    function test_aSupplyBecomesSharesAtItsHoursPrice() public {
        supply(SUPPLY);
        assertEq(usd.balanceOf(supplier), 0);
        (uint40 hour,) = shares.supplyOf(supplier);
        assertEq(hour, H1, "a request made after T0 settles at the next hour");
        vm.warp(H1);
        shares.roll(H1, 0);
        shares.claim(supplier);
        assertEq(shares.balanceOf(supplier), SUPPLY, "price 1 while value == supply");
        assertEq(shares.poolValue(), POOL + SUPPLY, "the supply joined the pool");
    }

    /// @dev D-307's cutoff: a request made after the hour, before the keeper's roll, waits for the next one.
    function test_aRequestAfterTheHourWaitsForTheNext() public {
        vm.warp(H1 + 5);
        supply(SUPPLY);
        shares.roll(H1, 0);
        shares.claim(supplier);
        assertEq(shares.balanceOf(supplier), 0, "not settled at H1: made after it");
        vm.warp(H2);
        shares.roll(H2, 0);
        shares.claim(supplier);
        assertEq(shares.balanceOf(supplier), SUPPLY);
    }

    function test_rollsRunInOrder() public {
        vm.warp(H2);
        shares.roll(H1, 0);
        vm.expectRevert(abi.encodeWithSelector(PoolShares.AlreadyRolled.selector, H1));
        shares.roll(H1, 0);
        vm.warp(H2 + 2 * HOUR);
        vm.expectRevert(abi.encodeWithSelector(PoolShares.RollOutOfOrder.selector, H2 + HOUR, H2));
        shares.roll(H2 + HOUR, 0);
        shares.roll(H2, 0);
    }

    function test_theRollWaitsForTheHoursWindows() public {
        uint256 id = open(UP, STAKE);
        fill(id, K);
        vm.warp(H1);
        vm.expectRevert(abi.encodeWithSelector(PoolShares.HourNotSettled.selector, T0 + CADENCE));
        shares.roll(H1, 0);
        settle(K - 100e8);
        vm.warp(H1);
        shares.roll(H1, 0);
        assertEq(shares.lastRoll(), H1);
    }

    function test_suppliersShareWhatTheirPoolKeeps() public {
        supply(SUPPLY);
        vm.warp(H1);
        shares.roll(H1, 0);
        shares.claim(supplier);
        windowAt(H1);
        uint256 id = open(UP, STAKE);
        fill(id, K);
        uint256 before = shares.poolValue();
        settleAt(H1, K - 100e8); // Up loses: the pool keeps the stake
        assertEq(shares.poolValue(), before + STAKE, "the loser's stake is the pool's");
        uint256 mine = shares.balanceOf(supplier);
        vm.prank(supplier);
        shares.requestWithdraw(mine);
        vm.warp(H2);
        uint256 valueBefore = shares.poolValue();
        shares.roll(H2, 0);
        shares.claim(supplier);
        uint256 paid = usd.balanceOf(supplier);
        assertGt(paid, SUPPLY, "a supplier's slice of the kept stake");
        assertEq(shares.poolValue(), valueBefore - paid, "value leaves only as the withdrawal");
    }

    /// @dev A withdrawal the liquid can't cover moves to the next hour whole, and holds that liquid from new risk.
    function test_aDeferredWithdrawalHoldsItsLiquidity() public {
        shares.requestWithdraw(shares.balanceOf(address(this)));
        vm.warp(H1 - 100);
        windowAt(H1); // a call open across the roll keeps part of the pool reserved
        uint256 id = open(UP, 1000e6);
        fill(id, K);
        shares.roll(H1, 0);
        assertTrue(reserve.withdrawHold() > reserve.liquid(), "the batch waits, holding what it needs");
        (,,,, uint40 movedTo) = shares.withdrawBatch(H1);
        assertEq(movedTo, H2);
        // Nothing new may take the held liquidity.
        Intent memory it = intent(ACTION_OPEN, UP, 0, STAKE, 0);
        uint256 more = reserve.commit(it, sign(OWNER_PK, it), noPermit());
        fill(more, K);
        assertEq(reserve.ticketOf(more).status, TICKET_REFUNDED, "no capacity under the hold");

        settleAt(H1, K + 100e8); // the call wins and is paid out
        claim(id);
        vm.warp(H2);
        shares.roll(H2, 0);
        assertEq(shares.totalSupply(), 0, "paid whole at the next roll");
        assertEq(reserve.withdrawHold(), 0, "and the hold is released");
    }

    /// @dev D-307: open rides are marked exactly at the roll — what they owe their riders comes off the value.
    function test_theRollMarksOpenRides() public {
        uint256 ride = openRide(true, MARGIN, LEV40);
        fillRide(ride, K);
        supply(SUPPLY);
        vm.warp(H1 + 3);
        record(H1 + 2, K + 600e8); // BTC +1 %: the long is up about $4
        vm.expectRevert(abi.encodeWithSelector(PoolShares.StaleMark.selector, H1 - 10));
        shares.roll(H1, H1 - 10); // a mark from before the hour
        vm.warp(H1 + 20);
        vm.expectRevert(abi.encodeWithSelector(PoolShares.StaleMark.selector, H1 + 2));
        shares.roll(H1, H1 + 2); // older than 5 s
        vm.warp(H1 + 4);
        int256 owed = reserve.markRides(H1 + 2);
        assertGt(owed, 3e6);
        uint256 atCost = shares.poolValue();
        vm.recordLogs();
        shares.roll(H1, H1 + 2);
        shares.claim(supplier);
        uint256 value = atCost - uint256(owed);
        assertEq(shares.balanceOf(supplier), SUPPLY * (POOL + 1) / (value + 1), "priced on the marked value");
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
        uint256 wallet = usd.balanceOf(owner);
        (PoolShares.EarnRequest memory r, bytes memory sig) = signed(shares.WITHDRAW(), SUPPLY, 3, OWNER_PK);
        shares.requestFor(r, sig, noPermit());
        assertEq(shares.balanceOf(owner), 0);
        vm.warp(H1);
        shares.roll(H1, 0);
        shares.claim(owner);
        assertEq(usd.balanceOf(owner), wallet + SUPPLY, "paid at the pool's price (1)");
    }

    function test_aRequestCanBeTakenBackUntilItsRoll() public {
        supply(SUPPLY);
        vm.prank(supplier);
        shares.cancel(true);
        assertEq(usd.balanceOf(supplier), SUPPLY);
        supply(SUPPLY);
        vm.warp(H1);
        shares.roll(H1, 0);
        vm.prank(supplier);
        vm.expectRevert(PoolShares.Settled.selector);
        shares.cancel(true);
    }
}
