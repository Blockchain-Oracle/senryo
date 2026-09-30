// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {PriceView} from "../../libraries/Types.sol";

/// @notice The engine's only price input (D-020): a pull oracle can replace SessionOracle behind this interface.
/// No function anywhere accepts a caller-supplied price (I6).
interface IPriceSource {
    /// @notice State-changing read: accepts a new feed round (or trips the circuit) and returns the result.
    function observe(uint8 marketId) external returns (PriceView memory);

    /// @notice What `observe` would return now, without writing.
    function peek(uint8 marketId) external view returns (PriceView memory);

    /// @notice True when every configured market is OPEN (LP redeem gate).
    function allOpen() external view returns (bool);
}
