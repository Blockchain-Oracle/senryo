// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// √ and the log-distance z from CWF d7b576b:contracts/src/products/range/RangeMath.sol and src/fair/FairValue.sol
// (Solady `lnWad`, `fullMulDiv`). New for Senryo: one band probability for every band kind around K (D-262/D-263), the
// settlement rule per kind, and the money roundings (payouts floor, debits ceil). v3 (D-300): the normal Φ table is
// replaced by the calibrated shape table (fitted and held-out-checked in R3.2), read from its own data contract so a
// recalibration is a parameter change (`setTailTable`), and σ follows the keeper's marks with a weight and a fade into
// the one-day anchor. Mirrored bit for bit by `packages/core/src/market/band-math.ts` with shared vectors.

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
import "./MarketTypes.sol";

/// @title BandMath — what a band around the window's open print is worth now, and how it settles.
/// @dev Fixed points: prices × 1e8, σ per √second × 1e8, probabilities × 1e6, z × 1e4, weights × 1e18.
library BandMath {
    uint256 internal constant WAD = 1e18;
    /// @dev A z past every table's last point (an edge below 1e-18 of the spot).
    int256 internal constant Z_BEYOND_E4 = 1e12;
    /// @dev z × 1e4 = ln(r)·1e18 · 1e4 / (std·1e10), std being σ√τ × 1e8.
    int256 internal constant Z_DIVISOR_SCALE = 1e10;
    uint8 internal constant BYTE_BITS = 8;
    uint256 internal constant HALF = 2;

    error BadBand(uint8 kind);
    error NonPositivePrice(int256 edgeE8, int256 spotE8);
    error NoVolatility();
    error BadTailTable(address table);

    /// @dev A shape table's header and horizons, loaded once per pricing; its rows are read entry by entry.
    struct Shape {
        address table;
        uint256 points;
        int256 zStepE4;
        int256 zMaxE4;
        uint256 weightWad;
        uint256 fadeWad;
        uint256 rowsAt;
        uint256[] taus;
    }

    // ------------------------------------------------------------------------------------------------ the table

    function shapeOf(address table) internal view returns (Shape memory s) {
        bytes memory h = SSTORE2.read(table, 0, TAIL_HEADER_BYTES);
        uint256 n = uint8(h[1]);
        s.table = table;
        s.points = _uint(h, TAIL_POINTS_AT, TAIL_U16_BYTES);
        s.zStepE4 = int256(_uint(h, TAIL_Z_STEP_AT, TAIL_U16_BYTES));
        s.zMaxE4 = int256(s.points - 1) * s.zStepE4;
        s.weightWad = _uint(h, TAIL_WEIGHT_AT, TAIL_U64_BYTES);
        s.fadeWad = _uint(h, TAIL_FADE_AT, TAIL_U64_BYTES);
        s.rowsAt = TAIL_HEADER_BYTES + n * TAIL_U16_BYTES;
        bytes memory t = SSTORE2.read(table, TAIL_HEADER_BYTES, s.rowsAt);
        s.taus = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            s.taus[i] = _uint(t, i * TAIL_U16_BYTES, TAIL_U16_BYTES);
        }
    }

    /// @notice Refuses a table that isn't one: the format, the sizes inside their bounds, horizons ascending, every row
    ///         a CDF from ½ (starting at ½, never falling, never past 1).
    function checkShape(address table) internal view {
        if (table.code.length <= TAIL_HEADER_BYTES) revert BadTailTable(table);
        bytes memory b = SSTORE2.read(table);
        uint256 n = uint8(b[1]);
        uint256 points = _uint(b, TAIL_POINTS_AT, TAIL_U16_BYTES);
        bool ok = uint8(b[0]) == TAIL_FORMAT && n >= TAIL_MIN_COUNT && n <= TAIL_MAX_TAUS && points >= TAIL_MIN_COUNT
            && points <= TAIL_MAX_POINTS && _uint(b, TAIL_Z_STEP_AT, TAIL_U16_BYTES) != 0
            && _uint(b, TAIL_WEIGHT_AT, TAIL_U64_BYTES) <= TAIL_MAX_WEIGHT_WAD
            && _uint(b, TAIL_FADE_AT, TAIL_U64_BYTES) <= TAIL_MAX_FADE_WAD
            && b.length == TAIL_HEADER_BYTES + n * TAIL_U16_BYTES + n * points * TAIL_ENTRY_BYTES;
        if (!ok) revert BadTailTable(table);
        uint256 last;
        for (uint256 i; i < n; ++i) {
            uint256 tau = _uint(b, TAIL_HEADER_BYTES + i * TAIL_U16_BYTES, TAIL_U16_BYTES);
            if (tau <= last) revert BadTailTable(table);
            last = tau;
        }
        uint256 at = TAIL_HEADER_BYTES + n * TAIL_U16_BYTES;
        for (uint256 r; r < n; ++r) {
            uint256 prev = _uint(b, at, TAIL_ENTRY_BYTES);
            if (prev != P_ONE / HALF) revert BadTailTable(table);
            for (uint256 i = 1; i < points; ++i) {
                uint256 v = _uint(b, at + i * TAIL_ENTRY_BYTES, TAIL_ENTRY_BYTES);
                if (v < prev || v > P_ONE) revert BadTailTable(table);
                prev = v;
            }
            at += points * TAIL_ENTRY_BYTES;
        }
    }

    function _uint(bytes memory b, uint256 at, uint256 len) private pure returns (uint256 v) {
        for (uint256 i; i < len; ++i) {
            v = (v << BYTE_BITS) | uint8(b[at + i]);
        }
    }

    // ------------------------------------------------------------------------------------------------ σ

    /// @notice σ_τ√τ × 1e8 over `tauSec` (floored at `MIN_SECONDS_LEFT`): the keeper's mark σ_m, trusted by a and faded
    ///         into the series' long-run σ_L over the horizon — σ_τ² = σ_L² + (σ_m² − σ_L²)·a·g(κτ), g(x) = (1 − e^{−x})/x.
    function stdE8(uint64 markE8, uint64 longE8, uint256 tauSec, Shape memory s) internal pure returns (uint256) {
        if (tauSec < MIN_SECONDS_LEFT) tauSec = MIN_SECONDS_LEFT;
        int256 longVar = int256(uint256(longE8) * longE8);
        int256 gap = int256(uint256(markE8) * markE8) - longVar;
        int256 varE16 = longVar + gap * int256(markShareWad(tauSec, s)) / int256(WAD);
        return FixedPointMathLib.sqrt(uint256(varE16) * tauSec);
    }

    /// @notice a · g(κτ) × 1e18: the share of the mark's departure from the long run a horizon of `tauSec` keeps.
    function markShareWad(uint256 tauSec, Shape memory s) internal pure returns (uint256) {
        uint256 x = s.fadeWad * tauSec;
        uint256 g = WAD;
        if (x != 0) g = (WAD - uint256(FixedPointMathLib.expWad(-int256(x)))) * WAD / x;
        return s.weightWad * g / WAD;
    }

    // ------------------------------------------------------------------------------------------------ the shape

    /// @notice F_τ(z) × 1e6: the calibrated chance a move over `tauSec` ends below z standard deviations — linear in z
    ///         between table points and in τ between table horizons (flat outside them), symmetric, 1 past the table.
    function cdfE6(int256 zE4, uint256 tauSec, Shape memory s) internal view returns (uint256) {
        if (zE4 < 0) return P_ONE - cdfE6(-zE4, tauSec, s);
        if (zE4 >= s.zMaxE4) return P_ONE;
        uint256 i = uint256(zE4 / s.zStepE4);
        uint256 frac = uint256(zE4 % s.zStepE4);
        (uint256 row, uint256 w) = rowOf(tauSec, s);
        uint256 lo = rowAt(row, i, frac, s);
        if (w == 0) return lo;
        uint256 hi = rowAt(row + 1, i, frac, s);
        return (lo * (WAD - w) + hi * w) / WAD;
    }

    /// @notice The table row at or below `tauSec` and the weight × 1e18 of the next one.
    function rowOf(uint256 tauSec, Shape memory s) internal pure returns (uint256 row, uint256 w) {
        uint256 last = s.taus.length - 1;
        if (tauSec <= s.taus[0]) return (0, 0);
        if (tauSec >= s.taus[last]) return (last, 0);
        while (s.taus[row + 1] <= tauSec) ++row;
        uint256 a = s.taus[row];
        w = (tauSec - a) * WAD / (s.taus[row + 1] - a);
    }

    /// @notice Row `row` of the table at z point `i` plus `frac` of the step to the next (two adjacent entries, read
    ///         in one copy).
    function rowAt(uint256 row, uint256 i, uint256 frac, Shape memory s) internal view returns (uint256) {
        uint256 at = s.rowsAt + (row * s.points + i) * TAIL_ENTRY_BYTES;
        bytes memory e = SSTORE2.read(s.table, at, at + (frac == 0 ? 1 : HALF) * TAIL_ENTRY_BYTES);
        uint256 lo = _uint(e, 0, TAIL_ENTRY_BYTES);
        if (frac == 0) return lo;
        uint256 hi = _uint(e, TAIL_ENTRY_BYTES, TAIL_ENTRY_BYTES);
        return lo + (hi - lo) * frac / uint256(s.zStepE4);
    }

    /// @notice z × 1e4 of `edge` from `spot`: ln(edge / spot) in standard deviations.
    function zOfE4(int256 edgeE8, int256 spotE8, uint256 std) internal pure returns (int256) {
        if (edgeE8 <= 0 || spotE8 <= 0) revert NonPositivePrice(edgeE8, spotE8);
        if (std == 0) revert NoVolatility();
        uint256 ratioWad = FixedPointMathLib.fullMulDiv(uint256(edgeE8), WAD, uint256(spotE8));
        // An edge below 1e-18 of the spot is Φ(−∞); lnWad would refuse the zero ratio.
        if (ratioWad == 0) return -Z_BEYOND_E4;
        int256 lnW = FixedPointMathLib.lnWad(int256(ratioWad));
        return lnW * int256(BPS) / (int256(std) * Z_DIVISOR_SCALE);
    }

    /// @notice P(close > edge) × 1e6 when the price is `spot` now, `tauSec` from the close.
    function aboveE6(int256 edgeE8, int256 spotE8, uint256 std, uint256 tauSec, Shape memory s)
        internal
        view
        returns (uint256)
    {
        return P_ONE - cdfE6(zOfE4(edgeE8, spotE8, std), tauSec, s);
    }

    // ------------------------------------------------------------------------------------------------ bands

    /// @notice A band menu entry is well formed: Up/Down carry no offsets; Range two, Moonshot/Crash one, each < 100%.
    function isValid(BandDef memory d) internal pure returns (bool) {
        if (d.kind == BAND_UP || d.kind == BAND_DOWN) return d.lowBps == 0 && d.highBps == 0;
        if (d.kind == BAND_RANGE) return d.lowBps > 0 && d.lowBps < BPS && d.highBps > 0 && d.highBps < BPS;
        if (d.kind == BAND_MOONSHOT || d.kind == BAND_CRASH) return d.lowBps > 0 && d.lowBps < BPS && d.highBps == 0;
        return false;
    }

    /// @notice A band as its 40-bit menu word (`SeriesBook.bands`).
    function pack(BandDef memory d) internal pure returns (uint40) {
        return uint40((uint256(d.kind) << BAND_KIND_SHIFT) | (uint256(d.lowBps) << BAND_LOW_SHIFT) | uint256(d.highBps));
    }

    function unpack(uint40 word) internal pure returns (BandDef memory d) {
        uint256 w = word;
        // forge-lint: disable-next-line(unsafe-typecast)
        d.kind = uint8((w >> BAND_KIND_SHIFT) & BAND_KIND_MASK);
        // forge-lint: disable-next-line(unsafe-typecast)
        d.lowBps = uint16((w >> BAND_LOW_SHIFT) & BAND_FIELD_MASK);
        // forge-lint: disable-next-line(unsafe-typecast)
        d.highBps = uint16(w & BAND_FIELD_MASK);
    }

    /// @notice `K × bps / 10,000`, floored.
    function offsetE8(int64 k, uint16 bps) internal pure returns (int256) {
        return int256(k) * int256(uint256(bps)) / int256(BPS);
    }

    /// @notice What the band pays out with, × 1e6, given the spot now, the seconds to expiry and σ — the keeper's
    ///         mark and the series' long run (D-262, D-300): Up `P(C > K)`, Down `P(C < K)`, Range `P(K−a ≤ C ≤ K+b)`,
    ///         Moonshot `P(C > K+x)`, Crash `P(C < K−x)`.
    function probE6(BandDef memory d, int64 k, int64 spot, uint64 markE8, uint64 longE8, uint256 tauSec, Shape memory s)
        internal
        view
        returns (uint256)
    {
        uint256 std = stdE8(markE8, longE8, tauSec, s);
        if (d.kind == BAND_UP) return aboveE6(k, spot, std, tauSec, s);
        if (d.kind == BAND_DOWN) return P_ONE - aboveE6(k, spot, std, tauSec, s);
        if (d.kind == BAND_RANGE) {
            uint256 lo = aboveE6(int256(k) - offsetE8(k, d.lowBps), spot, std, tauSec, s);
            uint256 hi = aboveE6(int256(k) + offsetE8(k, d.highBps), spot, std, tauSec, s);
            return lo > hi ? lo - hi : 0;
        }
        if (d.kind == BAND_MOONSHOT) return aboveE6(int256(k) + offsetE8(k, d.lowBps), spot, std, tauSec, s);
        if (d.kind == BAND_CRASH) return P_ONE - aboveE6(int256(k) - offsetE8(k, d.lowBps), spot, std, tauSec, s);
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

    /// @notice The half-spread at probability `probE6` (D-300, Polymarket's and Kalshi's curve): max(`minE6`,
    ///         4·h50·p(1−p)) — `h50E6` at p = ½, thinning toward the edges, never under the floor.
    function halfSpreadE6(uint256 pE6, uint32 h50E6, uint32 minE6) internal pure returns (uint256) {
        uint256 curve = SPREAD_CURVE_FACTOR * h50E6 * pE6 * (P_ONE - pE6) / (P_ONE * P_ONE);
        return curve > minE6 ? curve : minE6;
    }

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
