// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {IPythBoundary} from "./IPythBoundary.sol";

/// @notice Immutable adapter; latest display prices can never resolve a boundary.
contract PythBoundaryOracle {
    address public constant PYTH_TESTNET = 0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379;
    IPythBoundary public immutable receiver;

    struct Observation {
        int64 price;
        uint64 confidence;
        int32 exponent;
        uint64 publishTime;
        bytes32 proofHash;
        bool quality;
    }
    error InvalidProof();

    constructor(IPythBoundary receiver_) {
        if (block.chainid != 10143 || address(receiver_) != PYTH_TESTNET || address(receiver_).code.length == 0) {
            revert InvalidProof();
        }
        receiver = receiver_;
    }

    function fee(bytes[] calldata proof) external view returns (uint256) {
        return receiver.getUpdateFee(proof);
    }

    function verify(bytes32 feed, uint64 boundary, bytes[] calldata proof)
        external
        payable
        returns (Observation memory o)
    {
        if (msg.value != receiver.getUpdateFee(proof)) revert InvalidProof();
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = feed;
        IPythBoundary.PriceFeed[] memory values =
            receiver.parsePriceFeedUpdatesUnique{value: msg.value}(proof, ids, boundary, boundary + 5);
        if (values.length != 1 || values[0].id != feed) revert InvalidProof();
        IPythBoundary.Price memory p = values[0].price;
        // Reject future publications relative to consensus block time; never select a settlement price by this clock.
        // forge-lint: disable-next-line(block-timestamp)
        if (p.publishTime < boundary || p.publishTime > boundary + 5 || p.publishTime > block.timestamp) {
            revert InvalidProof();
        }
        bool quality = p.price > 0 && p.price <= 1e16 && p.expo == -8;
        // quality proves positive int64 price <= 1e16 before converting to unsigned.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (quality) quality = uint256(p.conf) * 10000 <= uint256(uint64(p.price)) * 25;
        // publishTime <= boundary + 5, whose checked uint64 addition above bounds this cast.
        // forge-lint: disable-next-line(unsafe-typecast)
        o = Observation(p.price, p.conf, p.expo, uint64(p.publishTime), keccak256(abi.encode(proof)), quality);
    }
}
