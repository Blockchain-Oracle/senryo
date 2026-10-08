// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IPyth} from "../../../src/markets/interfaces/IPyth.sol";

/// @notice Test Pyth receiver with the one property the markets rely on: `parsePriceFeedUpdatesUnique` returns only an
///         update whose publish time is in `[min, max]` and whose previous publish time is before `min`.
///         An update is `abi.encode(feedId, publishTime)` naming a print the test stored with `push`.
contract MockPyth is IPyth {
    uint256 public constant FEE = 1;

    struct Stored {
        int64 price;
        uint64 conf;
        int32 expo;
        uint64 prevPublishTime;
        bool exists;
    }

    mapping(bytes32 feedId => mapping(uint64 publishTime => Stored)) public stored;

    error PriceFeedNotFoundWithinRange();
    error InsufficientFee();

    function push(bytes32 feedId, uint64 publishTime, uint64 prevPublishTime, int64 price, uint64 conf, int32 expo)
        external
        returns (bytes memory proof)
    {
        stored[feedId][publishTime] = Stored(price, conf, expo, prevPublishTime, true);
        bytes[] memory updates = new bytes[](1);
        updates[0] = abi.encode(feedId, publishTime);
        return abi.encode(updates);
    }

    function getUpdateFee(bytes[] calldata data) external pure returns (uint256) {
        return FEE * data.length;
    }

    function parsePriceFeedUpdatesUnique(bytes[] calldata data, bytes32[] calldata ids, uint64 minTime, uint64 maxTime)
        external
        payable
        returns (PriceFeed[] memory feeds)
    {
        if (msg.value < FEE * data.length) revert InsufficientFee();
        feeds = new PriceFeed[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            bool found;
            for (uint256 j; j < data.length; ++j) {
                (bytes32 feedId, uint64 publishTime) = abi.decode(data[j], (bytes32, uint64));
                Stored memory s = stored[feedId][publishTime];
                if (feedId != ids[i] || !s.exists) continue;
                if (publishTime < minTime || publishTime > maxTime || s.prevPublishTime >= minTime) continue;
                Price memory p = Price(s.price, s.conf, s.expo, publishTime);
                feeds[i] = PriceFeed(feedId, p, p);
                found = true;
                break;
            }
            if (!found) revert PriceFeedNotFoundWithinRange();
        }
    }
}
