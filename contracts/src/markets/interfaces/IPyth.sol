// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @notice Minimal Pyth Core receiver ABI (no copied implementation). `parsePriceFeedUpdatesUnique` returns the update
///         whose publish time is in `[minTime, maxTime]` and whose previous publish time is before `minTime`: the one
///         first print at or after an instant, so nobody can pick a different one.
interface IPyth {
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
