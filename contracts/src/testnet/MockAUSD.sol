// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {MockStable} from "./MockStable.sol";

/// @title MockAUSD — practice AUSD on Monad testnet (labelled as such everywhere in the app).
contract MockAUSD is MockStable {
    constructor(address authority) MockStable("Mock AUSD (testnet)", "mAUSD", authority) {}
}
