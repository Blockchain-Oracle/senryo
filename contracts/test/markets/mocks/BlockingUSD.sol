// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {TestUSD} from "../../../src/markets/testnet/TestUSD.sol";

/// @notice Test USD with Circle's blacklist shape: a blocked address can neither send nor receive.
contract BlockingUSD is TestUSD {
    mapping(address account => bool) public blocked;

    error Blocked(address account);

    constructor(address authority) TestUSD(authority) {}

    function setBlocked(address account, bool on) external {
        blocked[account] = on;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (blocked[from]) revert Blocked(from);
        if (blocked[to]) revert Blocked(to);
        super._update(from, to, value);
    }
}
