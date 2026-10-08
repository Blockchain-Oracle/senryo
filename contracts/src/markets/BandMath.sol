// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Φ table, √ and σ√τ ported unchanged from CWF d7b576b:contracts/src/products/range/RangeMath.sol (itself Masayume
// 68f7a09, bit-exact with its golden vectors); the log-distance z from CWF d7b576b:contracts/src/fair/FairValue.sol
// (Solady `lnWad`, `fullMulDiv`). New for Senryo: one band probability for every band kind around K (D-262/D-263), the
// settlement rule per kind, and the money roundings (payouts floor, debits ceil). Mirrored bit for bit by the client
// runtime in S3/S5 with shared vectors.

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import "./MarketTypes.sol";

/// @title BandMath — what a band around the window's open print is worth now, and how it settles.
/// @dev Fixed points: prices × 1e8, `sigmaE8` is σ per √second × 1e8, probabilities × 1e6, z × 1e4.
library BandMath {
    int256 internal constant Z_STEP_E4 = 500;
    int256 internal constant Z_MAX_E4 = 40_000;
    uint256 internal constant TABLE_LAST = 80;
    uint256 internal constant TABLE_ENTRY_BYTES = 3;
    /// @dev Φ(z) × 1e6 for z = 0.00, 0.05 … 4.00 (81 entries, three bytes each); generated offline from erf.
    bytes internal constant CDF =
        hex"07a12007ef03083cb4088a0208d6bc0922b2096db709b79f0a003e0a476d0a8d060ad0e80b12f30b530a0b91140bccfd0c06b10c3e210c73440ca6100cd6810d04950d304e0d59b00d80c20da58e0dc8200de8840e06cb0e23070e3d490e55a50e6c310e81010e942b0ea5c50eb5e60ec4a30ed2130ede4c0ee9620ef36a0efc780f049e0f0bf10f12800f185c0f1d950f223a0f26590f29fe0f2d360f300b0f32870f34b50f369c0f38450f39b60f3af60f3c0b0f3cfa0f3dc80f3e780f3f100f3f910f3fff0f405d0f40ac0f40ef0f41280f41570f417f0f41a10f41bd0f41d40f41e80f41f80f42050f42100f42190f4220";
    uint256 internal constant WAD = 1e18;
    /// @dev z × 1e4 = ln(r)·1e18 · 1e4 / (std·1e10), std being σ√τ × 1e8.
    int256 internal constant Z_DIVISOR_SCALE = 1e10;
    /// @dev σ√τ × 1e8 = σE8 · ⌊√(τ · 1e4)⌋ / 100 — two extra digits under the root.
    uint256 internal constant ROOT_SCALE = 10_000;
    uint256 internal constant ROOT_DIVISOR = 100;
    uint8 internal constant BYTE_BITS = 8;
    uint256 internal constant HALF = 2;
    uint256 internal constant HI_BYTE = 2; // the third byte of an entry, and its shift in bytes

    error BadBand(uint8 kind);
    error NonPositivePrice(int256 edgeE8, int256 spotE8);
    error NoVolatility();

    // ------------------------------------------------------------------------------------------------ Φ

    /// @notice Φ(z) × 1e6, linear between table points, saturating past |z| = 4.
    function cdfE6(int256 zE4) internal pure returns (uint256) {
        if (zE4 < 0) return P_ONE - cdfE6(-zE4);
        if (zE4 >= Z_MAX_E4) return P_ONE;
        uint256 i = uint256(zE4 / Z_STEP_E4);
        uint256 frac = uint256(zE4 % Z_STEP_E4);
        uint256 lo = tableAt(i);
        uint256 hi = tableAt(i + 1);
        return lo + (hi - lo) * frac / uint256(Z_STEP_E4);
    }

    function tableAt(uint256 i) internal pure returns (uint256) {
        bytes memory t = CDF;
        uint256 at = i * TABLE_ENTRY_BYTES;
        return (uint256(uint8(t[at])) << (HI_BYTE * BYTE_BITS)) | (uint256(uint8(t[at + 1])) << BYTE_BITS)
            | uint256(uint8(t[at + HI_BYTE]));
    }

    /// @notice ⌊√x⌋.
    function isqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / HALF;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / HALF;
        }
    }

    /// @notice σ√τ × 1e8 over `tauSec` (floored at `MIN_SECONDS_LEFT`).
    function stdE8(uint64 sigmaE8, uint256 tauSec) internal pure returns (uint256) {
        if (tauSec < MIN_SECONDS_LEFT) tauSec = MIN_SECONDS_LEFT;
        return uint256(sigmaE8) * isqrt(tauSec * ROOT_SCALE) / ROOT_DIVISOR;
    }

    /// @notice z × 1e4 of `edge` from `spot`: ln(edge / spot) in standard deviations.
    function zOfE4(int256 edgeE8, int256 spotE8, uint256 std) internal pure returns (int256) {
        if (edgeE8 <= 0 || spotE8 <= 0) revert NonPositivePrice(edgeE8, spotE8);
        if (std == 0) revert NoVolatility();
        uint256 ratioWad = FixedPointMathLib.fullMulDiv(uint256(edgeE8), WAD, uint256(spotE8));
        // An edge below 1e-18 of the spot is Φ(−∞); lnWad would refuse the zero ratio.
        if (ratioWad == 0) return -Z_MAX_E4;
        int256 lnW = FixedPointMathLib.lnWad(int256(ratioWad));
        return lnW * int256(BPS) / (int256(std) * Z_DIVISOR_SCALE);
    }

    /// @notice P(close > edge) × 1e6 when the price is `spot` now.
    function aboveE6(int256 edgeE8, int256 spotE8, uint256 std) internal pure returns (uint256) {
        return P_ONE - cdfE6(zOfE4(edgeE8, spotE8, std));
    }

    // ------------------------------------------------------------------------------------------------ bands

    /// @notice A band menu entry is well formed: Up/Down carry no offsets; Range two, Moonshot/Crash one, each < 100%.
    function isValid(BandDef memory d) internal pure returns (bool) {
        if (d.kind == BAND_UP || d.kind == BAND_DOWN) return d.lowBps == 0 && d.highBps == 0;
        if (d.kind == BAND_RANGE) return d.lowBps > 0 && d.lowBps < BPS && d.highBps > 0 && d.highBps < BPS;
        if (d.kind == BAND_MOONSHOT || d.kind == BAND_CRASH) return d.lowBps > 0 && d.lowBps < BPS && d.highBps == 0;
        return false;
    }

    /// @notice `K × bps / 10,000`, floored.
    function offsetE8(int64 k, uint16 bps) internal pure returns (int256) {
        return int256(k) * int256(uint256(bps)) / int256(BPS);
    }

    /// @notice What the band pays out with, × 1e6, given the spot now and the seconds to expiry (D-262):
    ///         Up `P(C > K)`, Down `P(C < K)`, Range `P(K−a ≤ C ≤ K+b)`, Moonshot `P(C > K+x)`, Crash `P(C < K−x)`.
    function probE6(BandDef memory d, int64 k, int64 spot, uint64 sigmaE8, uint256 tauSec)
        internal
        pure
        returns (uint256)
    {
        uint256 std = stdE8(sigmaE8, tauSec);
        if (d.kind == BAND_UP) return aboveE6(k, spot, std);
        if (d.kind == BAND_DOWN) return P_ONE - aboveE6(k, spot, std);
        if (d.kind == BAND_RANGE) {
            uint256 lo = aboveE6(int256(k) - offsetE8(k, d.lowBps), spot, std);
            uint256 hi = aboveE6(int256(k) + offsetE8(k, d.highBps), spot, std);
            return lo > hi ? lo - hi : 0;
        }
        if (d.kind == BAND_MOONSHOT) return aboveE6(int256(k) + offsetE8(k, d.lowBps), spot, std);
        if (d.kind == BAND_CRASH) return P_ONE - aboveE6(int256(k) - offsetE8(k, d.lowBps), spot, std);
        revert BadBand(d.kind);
    }

    /// @notice How the band settles on the close print (D-263): Up/Down refund at exactly K; Range is inclusive;
    ///         Moonshot and Crash exclude their strike.
    function outcome(BandDef memory d, int64 k, int64 close) internal pure returns (uint8) {
        if (d.kind == BAND_UP || d.kind == BAND_DOWN) {
            if (close == k) return OUTCOME_REFUND;
            bool up = close > k;
            return (up == (d.kind == BAND_UP)) ? OUTCOME_WIN : OUTCOME_LOSE;
        }
        int256 c = close;
        if (d.kind == BAND_RANGE) {
            bool inside = c >= int256(k) - offsetE8(k, d.lowBps) && c <= int256(k) + offsetE8(k, d.highBps);
            return inside ? OUTCOME_WIN : OUTCOME_LOSE;
        }
        if (d.kind == BAND_MOONSHOT) return c > int256(k) + offsetE8(k, d.lowBps) ? OUTCOME_WIN : OUTCOME_LOSE;
        if (d.kind == BAND_CRASH) return c < int256(k) - offsetE8(k, d.lowBps) ? OUTCOME_WIN : OUTCOME_LOSE;
        revert BadBand(d.kind);
    }

    // ------------------------------------------------------------------------------------------------ money

    /// @notice Shares a stake buys at `qE6` per share: floored (payouts floor).
    function payoutFor(uint256 stake, uint256 qE6) internal pure returns (uint256) {
        return stake * P_ONE / qE6;
    }

    /// @notice What `shares` sell for at `bidE6`: floored.
    function proceedsFor(uint256 shares, uint256 bidE6) internal pure returns (uint256) {
        return shares * bidE6 / P_ONE;
    }

    /// @notice The basis leaving with `shares` of a ticket holding `payout` shares on `basis`: ceiled (debits ceil),
    ///         so the remaining basis never exceeds the remaining shares.
    function basisPart(uint256 basis, uint256 shares, uint256 payout) internal pure returns (uint256) {
        uint256 num = basis * shares;
        return num == 0 ? 0 : (num - 1) / payout + 1;
    }
}
