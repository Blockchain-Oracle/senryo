// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {Test} from "forge-std/Test.sol";
import {SenryoBinaryV1 as Binary} from "../../src/predictions/SenryoBinaryV1.sol";
import {PythBoundaryOracle} from "../../src/predictions/PythBoundaryOracle.sol";
import {IPythBoundary} from "../../src/predictions/IPythBoundary.sol";

/// @dev Adversarial fixture, not an authentication implementation.
contract CallbackPyth is IPythBoundary {
    address public target;
    bytes public callback;
    bytes4 public rejection;

    function configure(address target_, bytes calldata callback_) external {
        target = target_;
        callback = callback_;
    }

    function getUpdateFee(bytes[] calldata) external pure returns (uint256) {
        return 7;
    }

    function parsePriceFeedUpdatesUnique(bytes[] calldata, bytes32[] calldata ids, uint64 first, uint64)
        external
        payable
        returns (PriceFeed[] memory result)
    {
        (bool ok, bytes memory reason) = target.call{value: 7}(callback);
        require(!ok, "reentry succeeded");
        rejection = bytes4(reason);
        result = new PriceFeed[](1);
        result[0] = PriceFeed(ids[0], Price(100000, 100, -8, first), Price(100000, 100, -8, first));
    }
}

contract OracleReentrancyTest is Test {
    function testOracleCallbackCannotOpenTwice() public {
        vm.chainId(10143);
        vm.warp(1000);
        vm.deal(address(this), 200 ether);
        address receiver = 0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379;
        CallbackPyth fixture = new CallbackPyth();
        vm.etch(receiver, address(fixture).code);
        Binary market =
            new Binary(new PythBoundaryOracle(IPythBoundary(receiver)), address(this), address(this), address(this));
        market.setRiskPaused(false);
        bytes32 id = market.createRound{value: 100 ether}(market.BTC(), 900, 1800, address(this));
        bytes[] memory proof = new bytes[](0);
        CallbackPyth(receiver).configure(address(market), abi.encodeCall(Binary.recordOpening, (id, proof)));
        vm.warp(1800);
        market.recordOpening{value: 7}(id, proof);
        assertEq(CallbackPyth(receiver).rejection(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(uint8(market.round(id).state), uint8(Binary.State.Open));
        assertEq(market.totalEscrow(), 100 ether);
    }
}
