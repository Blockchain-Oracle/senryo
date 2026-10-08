// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {Test} from "forge-std/Test.sol";
import {SenryoBinaryV1 as Binary} from "../../src/predictions/SenryoBinaryV1.sol";
import {PythBoundaryOracle} from "../../src/predictions/PythBoundaryOracle.sol";
import {FixturePyth} from "./FixturePyth.sol";

contract BinaryHandler is Test {
    Binary public market;
    bytes32[2] public ids;
    address[3] public actors = [address(101), address(102), address(103)];
    uint256 private sequence;

    constructor(Binary m, bytes32 first, bytes32 second) {
        market = m;
        ids = [first, second];
    }

    function trade(uint256 actor, uint256 roundIndex, bool up, bool isBuy, uint256 raw) external {
        address owner = actors[actor % 3];
        bytes32 id = ids[roundIndex % 2];
        Binary.Round memory r = market.round(id);
        if (r.state != Binary.State.Open || block.timestamp + 16 >= r.cutoff) return;
        bytes32 op = bytes32(++sequence);
        if (isBuy) {
            uint256 amount = bound(raw, 0.01 ether, 5 ether);
            vm.deal(owner, owner.balance + amount);
            vm.prank(owner);
            try market.buy{value: amount}(id, up, 1, uint64(block.timestamp + 15), op) {} catch {}
        } else {
            Binary.Position memory p = market.position(id, owner);
            uint256 held = up ? p.up : p.down;
            if (held == 0) return;
            uint256 shares = bound(raw, 1, held);
            vm.prank(owner);
            try market.sell(id, up, shares, 1, uint64(block.timestamp + 15), op) {} catch {}
        }
    }

    function progress(uint256 secondsForward, uint256 roundIndex, uint256 outcome) external {
        vm.warp(block.timestamp + bound(secondsForward, 0, 120));
        bytes32 id = ids[roundIndex % 2];
        Binary.Round memory r = market.round(id);
        if (r.state != Binary.State.Open || block.timestamp < r.end) return;
        if (block.timestamp >= r.end + 120) {
            market.voidExpired(id);
            return;
        }
        bytes[] memory proof = new bytes[](1);
        int64 value = outcome % 3 == 0 ? int64(90000) : outcome % 3 == 1 ? int64(100000) : int64(110000);
        proof[0] = abi.encode(r.feed, value, uint64(100), int32(-8), r.end, r.end - 1);
        vm.deal(address(this), 7);
        market.resolve{value: 7}(id, proof);
    }

    function claim(uint256 actor, uint256 roundIndex) external {
        address owner = actors[actor % 3];
        bytes32 id = ids[roundIndex % 2];
        vm.prank(owner);
        try market.claim(id, bytes32(++sequence)) {} catch {}
        try market.claimLiquidity(id) {} catch {}
    }

    function withdraw(uint256 actor) external {
        address owner = actors[actor % 3];
        uint256 credit = market.creditOf(owner);
        if (credit == 0) return;
        vm.prank(owner);
        market.withdraw(credit, bytes32(++sequence));
    }
}

contract BinaryInvariantTest is Test {
    Binary market;
    BinaryHandler handler;
    bytes32[2] ids;

    function setUp() public {
        vm.chainId(10143);
        vm.warp(1000);
        vm.deal(address(this), 300 ether);
        FixturePyth fixture = new FixturePyth();
        vm.etch(0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379, address(fixture).code);
        FixturePyth receiver = FixturePyth(0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379);
        market = new Binary(new PythBoundaryOracle(receiver), address(this), address(this), address(this));
        market.setRiskPaused(false);
        ids[0] = market.createRound{value: 100 ether}(market.BTC(), 300, 1800, address(this));
        ids[1] = market.createRound{value: 100 ether}(market.ETH(), 900, 1800, address(this));
        vm.warp(1800);
        for (uint256 i; i < 2; i++) {
            bytes[] memory proof = new bytes[](1);
            proof[0] = abi.encode(
                i == 0 ? market.BTC() : market.ETH(), int64(100000), uint64(100), int32(-8), uint64(1800), uint64(1799)
            );
            market.recordOpening{value: 7}(ids[i], proof);
        }
        handler = new BinaryHandler(market, ids[0], ids[1]);
        targetContract(address(handler));
    }

    function invariantCollateralAndEveryShareAccounted() public view {
        assertGe(address(market).balance, market.totalEscrow() + market.totalCredits());
        uint256 escrow;
        uint256 credits = market.creditOf(address(this));
        for (uint256 a; a < 3; a++) {
            credits += market.creditOf(handler.actors(a));
        }
        assertEq(credits, market.totalCredits());
        for (uint256 i; i < 2; i++) {
            Binary.Round memory r = market.round(ids[i]);
            escrow += r.escrow;
            uint256 up = r.up;
            uint256 down = r.down;
            for (uint256 a; a < 3; a++) {
                Binary.Position memory p = market.position(ids[i], handler.actors(a));
                up += p.up;
                down += p.down;
            }
            assertEq(up, r.totalUp);
            assertEq(down, r.totalDown);
            if (uint8(r.state) < uint8(Binary.State.Up)) {
                assertEq(up, r.escrow);
                assertEq(down, r.escrow);
            } else if (r.state == Binary.State.Up) {
                assertGe(r.escrow, up);
            } else if (r.state == Binary.State.Down) {
                assertGe(r.escrow, down);
            } else {
                assertGe(2 * r.escrow, up + down);
            }
        }
        assertEq(escrow, market.totalEscrow());
    }
}
