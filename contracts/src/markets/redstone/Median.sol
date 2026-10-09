// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Ported from Mitoshi contracts/src/engine/verifiers/lib/Median.sol (Agari's `print/median.rs`).

/// @title The RedStone SDK's median: the middle value for an odd count, `⌊(a + b) / 2⌋` without overflow for an even one.
library Median {
    uint256 internal constant HALF_SHIFT = 1;
    uint256 internal constant HALF = 2;

    function avgFloor(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a >> HALF_SHIFT) + (b >> HALF_SHIFT) + (((a & 1) + (b & 1)) >> HALF_SHIFT);
    }

    /// @notice Sorts `values` in place (insertion sort; N ≤ 5) and returns the median. Reverts on an empty array.
    function median(uint256[] memory values) internal pure returns (uint256) {
        uint256 n = values.length;
        for (uint256 i = 1; i < n; ++i) {
            uint256 x = values[i];
            uint256 j = i;
            while (j > 0 && values[j - 1] > x) {
                values[j] = values[j - 1];
                --j;
            }
            values[j] = x;
        }
        uint256 mid = n / HALF;
        return n % HALF == 1 ? values[mid] : avgFloor(values[mid - 1], values[mid]);
    }
}
