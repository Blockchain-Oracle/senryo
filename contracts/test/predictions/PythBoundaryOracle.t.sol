// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {Test} from "forge-std/Test.sol";
import {PythBoundaryOracle} from "../../src/predictions/PythBoundaryOracle.sol";
import {IPythBoundary} from "../../src/predictions/IPythBoundary.sol";
import {FixturePyth} from "./FixturePyth.sol";

contract PythBoundaryOracleTest is Test {
    address constant RECEIVER = 0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379;
    bytes32 constant FEED = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    PythBoundaryOracle oracle;

    function setUp() public {
        vm.chainId(10143);
        vm.warp(1005);
        vm.deal(address(this), 1 ether);
        FixturePyth fixture = new FixturePyth();
        vm.etch(RECEIVER, address(fixture).code);
        oracle = new PythBoundaryOracle(IPythBoundary(RECEIVER));
    }

    function proof(int64 price, uint64 confidence, int32 exponent, uint64 time, uint64 previous)
        internal
        pure
        returns (bytes[] memory p)
    {
        p = new bytes[](1);
        p[0] = abi.encode(FEED, price, confidence, exponent, time, previous);
    }

    function testBoundaryInclusiveAndPreviousExclusive() public {
        PythBoundaryOracle.Observation memory o = oracle.verify{value: 7}(FEED, 1000, proof(100000, 250, -8, 1000, 999));
        assertTrue(o.quality);
        assertEq(o.publishTime, 1000);
        o = oracle.verify{value: 7}(FEED, 1000, proof(100000, 250, -8, 1005, 999));
        assertTrue(o.quality);
        vm.expectRevert();
        oracle.verify{value: 7}(FEED, 1000, proof(100000, 250, -8, 1001, 1000));
        vm.expectRevert();
        oracle.verify{value: 7}(FEED, 1000, proof(100000, 250, -8, 1006, 999));
    }

    function testQualityBoundsAreRecordedNotClipped() public {
        assertFalse(oracle.verify{value: 7}(FEED, 1000, proof(0, 0, -8, 1000, 999)).quality);
        assertFalse(oracle.verify{value: 7}(FEED, 1000, proof(-1, 0, -8, 1000, 999)).quality);
        assertFalse(oracle.verify{value: 7}(FEED, 1000, proof(100000, 251, -8, 1000, 999)).quality);
        assertFalse(oracle.verify{value: 7}(FEED, 1000, proof(100000, 0, -7, 1000, 999)).quality);
        assertFalse(oracle.verify{value: 7}(FEED, 1000, proof(10000000000000001, 0, -8, 1000, 999)).quality);
        assertTrue(oracle.verify{value: 7}(FEED, 1000, proof(10000000000000000, 0, -8, 1000, 999)).quality);
    }

    function testFeeForwardedExactlyAndProofIdentity() public {
        bytes[] memory p = proof(100000, 250, -8, 1000, 999);
        PythBoundaryOracle.Observation memory o = oracle.verify{value: 7}(FEED, 1000, p);
        assertEq(o.proofHash, keccak256(abi.encode(p)));
        assertEq(RECEIVER.balance, 7);
        assertEq(address(oracle).balance, 0);
        vm.expectRevert();
        oracle.verify{value: 6}(FEED, 1000, p);
        vm.expectRevert();
        oracle.verify{value: 8}(FEED, 1000, p);
    }

    function testFutureAndMalformedRejected() public {
        vm.warp(1000);
        vm.expectRevert();
        oracle.verify{value: 7}(FEED, 1000, proof(100000, 0, -8, 1001, 999));
        bytes[] memory malformed = new bytes[](1);
        malformed[0] = hex"abcd";
        vm.expectRevert();
        oracle.verify{value: 7}(FEED, 1000, malformed);
    }

    function testWrongReceiverAndWrongChainRejected() public {
        FixturePyth other = new FixturePyth();
        vm.expectRevert();
        new PythBoundaryOracle(other);
        vm.chainId(143);
        vm.expectRevert();
        new PythBoundaryOracle(IPythBoundary(RECEIVER));
    }
}
