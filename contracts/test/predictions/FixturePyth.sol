// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {IPythBoundary} from "../../src/predictions/IPythBoundary.sol";

/// @dev FIXTURE ONLY. Plain ABI bytes are NOT signed Pyth evidence. Never export/deploy in a public manifest.
contract FixturePyth is IPythBoundary {
    uint256 public constant FEE = 7;

    function getUpdateFee(bytes[] calldata) external pure returns (uint256) {
        return FEE;
    }

    function parsePriceFeedUpdatesUnique(bytes[] calldata data, bytes32[] calldata ids, uint64 minTime, uint64 maxTime)
        external
        payable
        returns (PriceFeed[] memory result)
    {
        require(msg.value == FEE && data.length == 1 && ids.length == 1, "fixture envelope");
        (bytes32 feed, int64 value, uint64 confidence, int32 exponent, uint64 published, uint64 previous) =
            abi.decode(data[0], (bytes32, int64, uint64, int32, uint64, uint64));
        require(
            feed == ids[0] && previous < minTime && published >= minTime && published <= maxTime,
            "fixture unique boundary"
        );
        result = new PriceFeed[](1);
        result[0] = PriceFeed(
            feed, Price(value, confidence, exponent, published), Price(value, confidence, exponent, published)
        );
    }
}
