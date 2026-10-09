// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// The correlation floor from CWF d7b576b:contracts/src/products/parlay/ParlayMath.sol `combine` (Masayume 68f7a09),
// keyed here by asset class instead of a shared expiry: every parlay leg is an open window at once, so legs that move
// together are the ones in one class (crypto, US stocks, metals, FX — the series' trading calendar).

import {BPS, MAX_PARLAY_LEGS, P_ONE, PARLAY_CORRELATION_BPS} from "./MarketTypes.sol";

/// @title ParlayMath — a parlay's joint chance from its legs' (D-293), mirrored by `@senryo/core` `parlayChanceE6`.
/// @dev Within a class the joint chance is the product, floored at 85 % of the least likely leg there (two coins
///      that move together are not two coin flips); across classes the classes' chances multiply. Every rounding is up
///      — a higher chance pays less — so the pool is never short.
library ParlayMath {
    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    /// @param probsE6 each leg's probability × 1e6 (0 = a dropped leg, skipped)
    /// @param groups each leg's class
    function chanceE6(uint256[] memory probsE6, uint8[] memory groups) internal pure returns (uint256 chance) {
        chance = P_ONE;
        uint256 n = probsE6.length;
        bool[MAX_PARLAY_LEGS] memory done;
        for (uint256 i; i < n; ++i) {
            if (done[i] || probsE6[i] == 0) continue;
            uint256 joint = P_ONE;
            uint256 least = P_ONE;
            uint256 count;
            for (uint256 j = i; j < n; ++j) {
                if (done[j] || probsE6[j] == 0 || groups[j] != groups[i]) continue;
                done[j] = true;
                joint = ceilDiv(joint * probsE6[j], P_ONE);
                if (probsE6[j] < least) least = probsE6[j];
                ++count;
            }
            if (count > 1) {
                uint256 floor = ceilDiv(least * PARLAY_CORRELATION_BPS, BPS);
                if (floor > joint) joint = floor;
            }
            chance = ceilDiv(chance * joint, P_ONE);
        }
    }
}
