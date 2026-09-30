// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AggregatorV3Interface} from "../../src/oracle/interfaces/AggregatorV3Interface.sol";
import {ICollateralSwapper} from "../../src/interfaces/ISenryoCore.sol";

/// @notice Fully controllable AggregatorV3 for oracle scenarios (arbitrary updatedAt / answeredInRound).
contract MockFeed is AggregatorV3Interface {
    struct R {
        int256 answer;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    uint8 public immutable decimals;
    string public description;
    uint256 public constant version = 4;
    uint80 public latest;
    mapping(uint80 => R) public rounds;

    constructor(uint8 d, string memory desc) {
        decimals = d;
        description = desc;
    }

    function push(int256 answer) external returns (uint80) {
        return pushAt(answer, block.timestamp);
    }

    function pushAt(int256 answer, uint256 updatedAt) public returns (uint80 id) {
        id = ++latest;
        rounds[id] = R(answer, updatedAt, id);
    }

    function setAnsweredInRound(uint80 id, uint80 air) external {
        rounds[id].answeredInRound = air;
    }

    function getRoundData(uint80 id) external view returns (uint80, int256, uint256, uint256, uint80) {
        R memory r = rounds[id];
        require(r.updatedAt != 0, "No data present");
        return (id, r.answer, r.updatedAt, r.updatedAt, r.answeredInRound);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        R memory r = rounds[latest];
        return (latest, r.answer, r.updatedAt, r.updatedAt, r.answeredInRound);
    }
}

/// @notice Open-mint 6-decimal token for checks.
contract TestToken is ERC20 {
    constructor(string memory n) ERC20(n, n) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Par swap double for SenryoCore.swapCollateral (the real adapter needs a Uniswap v4 fork).
contract ParSwapper is ICollateralSwapper {
    function swap(address, address tokenOut, uint256 amountIn, uint256) external returns (uint256) {
        TestToken(tokenOut).mint(msg.sender, amountIn);
        return amountIn;
    }
}
