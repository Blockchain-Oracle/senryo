// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @notice The slice of SenryoCore that periphery contracts call.
interface ISenryoCore {
    function depositFor(address token, uint256 amount, address beneficiary) external;

    function increaseFor(
        address user,
        uint8 marketId,
        bool isLong,
        uint256 notionalUsd6,
        uint256 acceptablePrice18,
        uint64 deadline
    ) external;

    function fundPool(uint256 amount) external;

    function drainPool(uint256 amount, address to) external;

    function poolValue(bool poolFavourable) external view returns (uint256);

    function allMarketsOpen() external view returns (bool);
}

/// @notice Swap adapter called by the core (CollateralSwapper; a test double in checks).
interface ICollateralSwapper {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        external
        returns (uint256 amountOut);
}

/// @notice Used by the core to recognise inbox deposits (DepositSource.INBOX).
interface IInboxFactory {
    function inboxOf(address user) external view returns (address);
}
