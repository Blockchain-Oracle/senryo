// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {AggregatorV3Interface} from "../oracle/interfaces/AggregatorV3Interface.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";

/// @title MirrorAggregator — testnet-only AggregatorV3-compatible feed (no XAU/XAG feed exists on 10143, D-006).
/// @notice A keeper (MIRROR_ROLE) mirrors the mainnet Chainlink answer; `updatedAt` is always the block time of the
/// push, so the testnet oracle ages honestly. Emits Chainlink's AnswerUpdated/NewRound so the indexer treats it as a
/// real aggregator. Refuses to deploy on mainnet.
contract MirrorAggregator is AccessManaged, AggregatorV3Interface {
    struct Round {
        int256 answer;
        uint64 startedAt;
        uint64 updatedAt;
    }

    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);
    event NewRound(uint256 indexed roundId, address indexed startedBy, uint256 startedAt);

    error NoDataPresent();

    uint8 public immutable decimals;
    uint256 public constant version = 4;
    string public description;
    uint80 public latestRound;
    mapping(uint80 roundId => Round) private _rounds;

    constructor(address authority, uint8 decimals_, string memory description_, int256 initialAnswer)
        AccessManaged(authority)
    {
        if (block.chainid == C.MAINNET_CHAIN_ID) revert Errors.TestnetOnly(block.chainid);
        decimals = decimals_;
        description = description_;
        if (initialAnswer > 0) _push(initialAnswer);
    }

    /// @notice MIRROR_ROLE: publish a new round.
    function pushAnswer(int256 answer) external restricted {
        if (answer <= 0) revert Errors.FeedAnswerInvalid();
        _push(answer);
    }

    function getRoundData(uint80 roundId) external view returns (uint80, int256, uint256, uint256, uint80) {
        Round memory r = _rounds[roundId];
        if (r.updatedAt == 0) revert NoDataPresent();
        return (roundId, r.answer, r.startedAt, r.updatedAt, roundId);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        uint80 id = latestRound;
        Round memory r = _rounds[id];
        if (r.updatedAt == 0) revert NoDataPresent();
        return (id, r.answer, r.startedAt, r.updatedAt, id);
    }

    function _push(int256 answer) private {
        uint80 id = ++latestRound;
        _rounds[id] = Round(answer, uint64(block.timestamp), uint64(block.timestamp));
        emit NewRound(id, msg.sender, block.timestamp);
        emit AnswerUpdated(answer, id, block.timestamp);
    }
}
