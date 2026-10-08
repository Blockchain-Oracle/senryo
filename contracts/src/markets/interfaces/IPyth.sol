// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @notice Minimal Pyth Core ABI; no copied implementation. Unique parser authenticates previous-publish ordering.
interface IPythBoundary {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    struct PriceFeed {
        bytes32 id;
        Price price;
        Price emaPrice;
    }
    function getUpdateFee(bytes[] calldata data) external view returns (uint256);
    function parsePriceFeedUpdatesUnique(bytes[] calldata data, bytes32[] calldata ids, uint64 minTime, uint64 maxTime)
        external
        payable
        returns (PriceFeed[] memory);
}
