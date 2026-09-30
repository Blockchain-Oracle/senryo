// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {MockStable} from "./MockStable.sol";

/// @title MockUSDC — practice USDC on Monad testnet (labelled as such everywhere in the app).
contract MockUSDC is MockStable {
    constructor(address authority) MockStable("Mock USDC (testnet)", "mUSDC", authority) {}
}
