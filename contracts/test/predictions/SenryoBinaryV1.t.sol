// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {Test} from "forge-std/Test.sol";
import {SenryoBinaryV1 as Binary} from "../../src/predictions/SenryoBinaryV1.sol";
import {PythBoundaryOracle} from "../../src/predictions/PythBoundaryOracle.sol";
import {FixturePyth} from "./FixturePyth.sol";

contract WithdrawalActor {
    Binary public market;
    bool public reject = true;
    bool public reenter;

    constructor(Binary market_) {
        market = market_;
    }

    function configure(bool reject_, bool reenter_) external {
        reject = reject_;
        reenter = reenter_;
    }

    function buy(bytes32 id) external payable {
        market.buy{value: msg.value}(id, true, 1, uint64(block.timestamp + 15), keccak256("actor-buy"));
    }

    function claim(bytes32 id) external {
        market.claim(id, keccak256("actor-claim"));
    }

    function withdraw(bytes32 op) external returns (bool) {
        return market.withdraw(market.creditOf(address(this)), op);
    }

    receive() external payable {
        require(!reject, "reject");
        if (reenter) market.withdraw(1, keccak256("reenter"));
    }
}

contract SenryoBinaryV1Test is Test {
    bytes32 constant BTC = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    Binary m;
    FixturePyth receiver;
    PythBoundaryOracle oracle;
    bytes32 id;
    uint64 start = 1800;
    address alice = address(0xa11ce);
    address bob = address(0xb0b);
    uint256 sequence;

    function setUp() public {
        vm.chainId(10143);
        vm.warp(1000);
        vm.deal(address(this), 10000 ether);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        FixturePyth fixture = new FixturePyth();
        vm.etch(0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379, address(fixture).code);
        receiver = FixturePyth(0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379);
        oracle = new PythBoundaryOracle(receiver);
        m = new Binary(oracle, address(this), address(this), address(this));
        m.setRiskPaused(false);
        id = m.createRound{value: 100 ether}(BTC, 900, start, address(this));
    }

    function proof(bytes32 feed, int64 price, uint64 conf, int32 expo, uint64 time, uint64 previous)
        internal
        pure
        returns (bytes[] memory p)
    {
        p = new bytes[](1);
        p[0] = abi.encode(feed, price, conf, expo, time, previous);
    }

    function good(uint64 time, int64 price) internal pure returns (bytes[] memory) {
        return proof(BTC, price, 100, -8, time, time - 1);
    }

    function open() internal {
        vm.warp(start);
        m.recordOpening{value: 7}(id, good(start, 100000));
    }

    function op() internal returns (bytes32) {
        return bytes32(++sequence);
    }

    function buy(address who, bool side, uint256 value) internal returns (uint256) {
        vm.prank(who);
        return m.buy{value: value}(id, side, 1, uint64(block.timestamp + 15), op());
    }

    function solvent() internal view {
        assertGe(address(m).balance, m.totalEscrow() + m.totalCredits());
    }

    function settle(int64 price) internal {
        vm.warp(start + 900);
        m.resolve{value: 7}(id, good(start + 900, price));
    }

    function testBuySellSettleClaimWithdrawLifecycle() public {
        open();
        uint256 shares = buy(alice, true, 3 ether);
        uint256 b = buy(bob, false, 2 ether);
        uint256 sold = shares / 3;
        uint256 quoted = m.quoteSell(id, true, sold).output;
        vm.prank(alice);
        assertEq(m.sell(id, true, sold, quoted, uint64(block.timestamp + 15), op()), quoted);
        assertEq(m.creditOf(alice), quoted);
        assertEq(alice.balance, 997 ether);
        solvent();
        settle(110000);
        m.setRiskPaused(true);
        vm.prank(alice);
        assertEq(m.claim(id, op()), shares - sold);
        vm.prank(bob);
        assertEq(m.claim(id, op()), 0);
        assertGt(b, 0);
        m.claimLiquidity(id);
        uint256 credit = m.creditOf(alice);
        vm.prank(alice);
        assertTrue(m.withdraw(credit, op()));
        assertEq(alice.balance, 997 ether + credit);
        assertEq(m.totalEscrow(), 0);
        solvent();
    }

    function testFractionalVoidIsNotPrincipalRefund() public {
        open();
        uint256 shares = buy(alice, true, 5 ether);
        vm.warp(start + 1020);
        m.voidExpired(id);
        vm.prank(alice);
        uint256 credit = m.claim(id, op());
        assertEq(credit, shares / 2);
        assertLt(credit, 5 ether);
        m.claimLiquidity(id);
        assertLe(m.totalEscrow(), 1);
        solvent();
    }

    function testTieCombinesBothSidesBeforeRounding() public {
        open();
        buy(alice, true, 1 ether);
        buy(alice, false, 1 ether);
        Binary.Position memory p = m.position(id, alice);
        settle(100000);
        vm.prank(alice);
        assertEq(m.claim(id, op()), (p.up + p.down) / 2);
        solvent();
    }

    function testPauseBlocksRiskButNotExitOrTimeout() public {
        open();
        uint256 s = buy(alice, true, 1 ether);
        m.setRiskPaused(true);
        vm.expectRevert();
        vm.prank(alice);
        m.buy{value: 1 ether}(id, true, 1, start + 15, op());
        vm.prank(alice);
        m.sell(id, true, s, 1, start + 15, op());
        vm.warp(start + 1020);
        m.voidExpired(id);
        m.claimLiquidity(id);
        solvent();
    }

    function testOperationDedupAndSlippage() public {
        open();
        uint256 q = m.quoteBuy(id, true, 1 ether).output;
        vm.expectRevert(Binary.Slippage.selector);
        vm.prank(alice);
        m.buy{value: 1 ether}(id, true, q + 1, start + 15, bytes32(uint256(7)));
        assertFalse(m.usedOperation(alice, bytes32(uint256(7))));
        vm.prank(alice);
        m.buy{value: 1 ether}(id, true, q, start + 15, bytes32(uint256(7)));
        vm.expectRevert(Binary.Duplicate.selector);
        vm.prank(alice);
        m.buy{value: 1 ether}(id, true, 1, start + 15, bytes32(uint256(7)));
    }

    function testCutoffAndDeadlineExclusive() public {
        open();
        uint256 s = buy(alice, true, 1 ether);
        vm.expectRevert(Binary.Closed.selector);
        vm.prank(alice);
        m.sell(id, true, s, 1, start, op());
        vm.warp(start + 890);
        vm.expectRevert(Binary.Closed.selector);
        m.quoteSell(id, true, s);
        vm.expectRevert(Binary.Closed.selector);
        m.quoteBuy(id, true, 1 ether);
    }

    function testBadEarliestCannotBeReplaced() public {
        vm.warp(start);
        m.recordOpening{value: 7}(id, proof(BTC, 100000, 251, -8, start, start - 1));
        assertEq(uint8(m.round(id).state), uint8(Binary.State.OpeningInvalid));
        vm.expectRevert(Binary.Closed.selector);
        m.recordOpening{value: 7}(id, good(start, 100000));
        vm.warp(start + 30);
        m.voidExpired(id);
        assertEq(uint8(m.round(id).state), uint8(Binary.State.Void));
    }

    function testClosingBadQualityWaitsForDeclaredDeadline() public {
        open();
        vm.warp(start + 900);
        m.resolve{value: 7}(id, proof(BTC, 100000, 0, -7, start + 900, start + 899));
        vm.expectRevert(Binary.Closed.selector);
        m.voidExpired(id);
        vm.expectRevert(Binary.Closed.selector);
        m.resolve{value: 7}(id, good(start + 900, 100000));
        vm.warp(start + 1020);
        m.voidExpired(id);
    }

    function testMissingOpeningNeverResolvesRetroactively() public {
        vm.warp(start + 30);
        vm.expectRevert(Binary.Closed.selector);
        m.recordOpening{value: 7}(id, good(start, 100000));
        vm.warp(start + 900);
        vm.expectRevert(Binary.Closed.selector);
        m.resolve{value: 7}(id, good(start + 900, 100000));
        m.voidExpired(id);
    }

    function testUniqueFixtureRejectsWrongFeedLaterTickFutureAndFee() public {
        vm.warp(start);
        vm.expectRevert();
        m.recordOpening{value: 7}(id, proof(ETH, 100000, 0, -8, start, start - 1));
        vm.expectRevert();
        m.recordOpening{value: 7}(id, proof(BTC, 100000, 0, -8, start + 1, start));
        vm.expectRevert();
        m.recordOpening{value: 7}(id, proof(BTC, 100000, 0, -8, start + 1, start - 1));
        vm.expectRevert();
        m.recordOpening{value: 8}(id, good(start, 100000));
        assertEq(m.totalEscrow(), 100 ether);
    }

    function testWithdrawalFailureAndReentrancyRestoreCredit() public {
        open();
        WithdrawalActor a = new WithdrawalActor(m);
        a.buy{value: 1 ether}(id);
        settle(110000);
        a.claim(id);
        uint256 value = m.creditOf(address(a));
        assertFalse(a.withdraw(op()));
        assertEq(m.creditOf(address(a)), value);
        a.configure(false, true);
        assertFalse(a.withdraw(op()));
        assertEq(m.creditOf(address(a)), value);
        a.configure(false, false);
        assertTrue(a.withdraw(op()));
        assertEq(address(a).balance, value);
        assertEq(m.creditOf(address(a)), 0);
        solvent();
    }

    function testRolesSeedLockAndCrossRoundIsolation() public {
        vm.expectRevert(Binary.Unauthorized.selector);
        vm.prank(alice);
        m.setRiskPaused(false);
        vm.expectRevert(Binary.Invalid.selector);
        m.createRound{value: 100 ether}(BTC, 300, 1500, alice);
        bytes32 other = m.createRound{value: 10 ether}(ETH, 300, 1500, address(this));
        open();
        buy(alice, true, 2 ether);
        assertEq(m.round(other).escrow, 10 ether);
        vm.expectRevert(Binary.Closed.selector);
        m.claimLiquidity(id);
        vm.expectRevert();
        vm.prank(bob);
        m.sell(id, true, 1 ether, 1, start + 15, op());
        solvent();
    }

    function testFiveMinuteAndEightRoundCap() public {
        for (uint64 i = 0; i < 7; i++) {
            m.createRound{value: 10 ether}(ETH, 300, 1500 + i * 300, address(this));
        }
        assertEq(m.activeRounds(), 8);
        vm.expectRevert(Binary.Closed.selector);
        m.createRound{value: 10 ether}(BTC, 300, 1500, address(this));
        vm.warp(start + 30);
        m.voidExpired(id);
        assertEq(m.activeRounds(), 7);
    }

    function testFuzzTradeCycleAndCollateral(uint96 raw, uint8 cycles) public {
        open();
        uint256 amount = bound(raw, 0.01 ether, 5 ether);
        uint256 n = bound(cycles, 1, 20);
        uint256 before = alice.balance;
        for (uint256 i = 0; i < n; i++) {
            uint256 s = buy(alice, i % 2 == 0, amount);
            vm.prank(alice);
            m.sell(id, i % 2 == 0, s, 1, start + 15, op());
            solvent();
            Binary.Round memory r = m.round(id);
            assertEq(r.totalUp, r.escrow);
            assertEq(r.totalDown, r.escrow);
        }
        assertLe(alice.balance + m.creditOf(alice), before);
        settle(90000);
        m.claimLiquidity(id);
        assertEq(m.totalEscrow(), 0);
        solvent();
    }

    function testDuplicateClaimsAndFinalization() public {
        open();
        buy(alice, true, 1 ether);
        settle(110000);
        vm.expectRevert(Binary.Closed.selector);
        m.resolve{value: 7}(id, good(start + 900, 110000));
        vm.prank(alice);
        m.claim(id, op());
        vm.expectRevert(Binary.Invalid.selector);
        vm.prank(alice);
        m.claim(id, op());
        m.claimLiquidity(id);
        vm.expectRevert(Binary.Duplicate.selector);
        m.claimLiquidity(id);
        vm.expectRevert(Binary.Closed.selector);
        m.voidExpired(id);
        solvent();
    }

    function testForcedMonNeverCreatesSharesOrCredits() public {
        open();
        buy(alice, true, 1 ether);
        uint256 escrow = m.totalEscrow();
        uint256 credits = m.totalCredits();
        vm.deal(address(m), address(m).balance + 13 ether);
        assertEq(m.totalEscrow(), escrow);
        assertEq(m.totalCredits(), credits);
        settle(110000);
        vm.prank(alice);
        m.claim(id, op());
        m.claimLiquidity(id);
        assertEq(address(m).balance, m.totalCredits() + 13 ether);
    }

    function testSeedScheduleAndBuyBounds() public {
        vm.expectRevert(Binary.Invalid.selector);
        m.createRound{value: 9 ether}(BTC, 300, 1500, address(this));
        vm.expectRevert(Binary.Invalid.selector);
        m.createRound{value: 101 ether}(BTC, 300, 1500, address(this));
        vm.expectRevert(Binary.Invalid.selector);
        m.createRound{value: 10 ether}(BTC, 300, 1501, address(this));
        vm.expectRevert(Binary.Invalid.selector);
        m.createRound{value: 10 ether}(BTC, 60, 1500, address(this));
        vm.expectRevert(Binary.Invalid.selector);
        m.createRound{value: 10 ether}(BTC, 300, 4800, address(this));
        open();
        vm.expectRevert(Binary.Invalid.selector);
        m.quoteBuy(id, true, 0.01 ether - 1);
        vm.expectRevert(Binary.Invalid.selector);
        m.quoteBuy(id, true, 5 ether + 1);
    }

    function testSupplyCapAndExtremeSkewPreservePositiveReserves() public {
        open();
        vm.deal(alice, 1000 ether);
        for (uint256 i; i < 180; i++) {
            buy(alice, true, 5 ether);
        }
        Binary.Round memory r = m.round(id);
        assertEq(r.escrow, 1000 ether);
        assertGt(r.up, 0);
        assertGt(r.down, 0);
        vm.expectRevert(Binary.Invalid.selector);
        m.quoteBuy(id, true, 0.01 ether);
        Binary.Position memory p = m.position(id, alice);
        uint256 q = m.quoteSell(id, true, p.up).output;
        vm.expectRevert(Binary.Slippage.selector);
        vm.prank(alice);
        m.sell(id, true, p.up, q + 1, start + 15, op());
        vm.prank(alice);
        m.sell(id, true, p.up, q, start + 15, op());
        assertLe(q, 900 ether);
        solvent();
    }

    function testClosingDeadlineExclusive() public {
        open();
        vm.warp(start + 1020);
        vm.expectRevert(Binary.Closed.selector);
        m.resolve{value: 7}(id, good(start + 900, 110000));
        m.voidExpired(id);
    }

    function testWrongChainConstructor() public {
        vm.chainId(143);
        vm.expectRevert(Binary.Invalid.selector);
        new Binary(oracle, address(this), address(this), address(this));
    }
    receive() external payable {}
}
