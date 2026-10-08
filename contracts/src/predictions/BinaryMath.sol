// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Original zero-fee complete-set AMM. All units are share/MON wei.
library BinaryMath {
    uint256 internal constant CAP = 1000 ether;
    error InvalidAmount();

    function buy(uint256 x, uint256 y, uint256 c) internal pure returns (uint256 out) {
        if (x == 0 || y == 0 || x > CAP || y > CAP || c == 0 || c > CAP) revert InvalidAmount();
        uint256 remaining = Math.ceilDiv(x * y, y + c);
        out = x + c - remaining;
    }

    function sell(uint256 x, uint256 y, uint256 s) internal pure returns (uint256 out) {
        if (x == 0 || y == 0 || x > CAP || y > CAP || s == 0 || s > CAP) revert InvalidAmount();
        uint256 a = x + s;
        uint256 diff = a > y ? a - y : y - a;
        uint256 d = diff * diff + 4 * x * y;
        uint256 root = Math.sqrt(d, Math.Rounding.Ceil);
        out = (a + y - root) / 2;
        if (out >= y || out >= a || (a - out) * (y - out) < x * y) revert InvalidAmount();
    }
}
