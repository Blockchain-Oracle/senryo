// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Constants as C} from "./Constants.sol";

/// @title PerpMath — pure position maths (risk-math.md). Every rounding goes against the account.
library PerpMath {
    using Math for uint256;
    using SafeCast for uint256;

    /// @notice N = ⌈size × price / 1e30⌉ (usd6). Margin, fees and caps use this rounded-up value.
    function notional(uint256 size, uint256 price18) internal pure returns (uint256) {
        return size.mulDiv(price18, C.NOTIONAL_SCALE, Math.Rounding.Ceil);
    }

    /// @notice Units bought for `notionalUsd6` at `price18`, rounded down (fewer units for the account).
    function sizeFor(uint256 notionalUsd6, uint256 price18) internal pure returns (uint256) {
        return notionalUsd6.mulDiv(C.NOTIONAL_SCALE, price18, Math.Rounding.Floor);
    }

    /// @notice uPnL / realised PnL = σ × size × (exit − entry) / 1e30, rounded toward −∞.
    function pnl(bool isLong, uint256 size, uint256 entry18, uint256 exit18) internal pure returns (int256) {
        bool gain = isLong ? exit18 > entry18 : exit18 < entry18;
        uint256 diff = exit18 > entry18 ? exit18 - entry18 : entry18 - exit18;
        if (gain) return size.mulDiv(diff, C.NOTIONAL_SCALE, Math.Rounding.Floor).toInt256();
        return -size.mulDiv(diff, C.NOTIONAL_SCALE, Math.Rounding.Ceil).toInt256();
    }

    /// @notice Price moved against the account by `spreadBps`: `up` = ask (buys), else bid (sells).
    function applySpread(uint256 price18, uint256 spreadBps, bool up) internal pure returns (uint256) {
        if (up) return price18.mulDiv(C.BPS + spreadBps, C.BPS, Math.Rounding.Ceil);
        if (spreadBps >= C.BPS) return 0;
        return price18.mulDiv(C.BPS - spreadBps, C.BPS, Math.Rounding.Floor);
    }

    /// @notice Size-weighted average entry; longs round up and shorts down (the worse entry for the account).
    function averageEntry(uint256 size0, uint256 entry0, uint256 sizeDelta, uint256 price18, bool isLong)
        internal
        pure
        returns (uint256)
    {
        uint256 total = size0 + sizeDelta;
        uint256 weighted = size0 * entry0 + sizeDelta * price18;
        return isLong ? weighted.ceilDiv(total) : weighted / total;
    }

    /// @notice ⌈x × bps / BPS⌉ — charges (fees, margin, penalties).
    function bpsUp(uint256 x, uint256 bps) internal pure returns (uint256) {
        return x.mulDiv(bps, C.BPS, Math.Rounding.Ceil);
    }

    /// @notice ⌊x × bps / BPS⌋ — allowances (caps, shares paid out).
    function bpsDown(uint256 x, uint256 bps) internal pure returns (uint256) {
        return x.mulDiv(bps, C.BPS, Math.Rounding.Floor);
    }

    /// @notice Age spread: ⌈age × AGE_SPREAD_BPS_PER_HOUR / 3600⌉, capped.
    function ageSpreadBps(uint256 age) internal pure returns (uint256) {
        return
            Math.min(
                age.mulDiv(C.AGE_SPREAD_BPS_PER_HOUR, C.SECONDS_PER_HOUR, Math.Rounding.Ceil), C.AGE_SPREAD_CAP_BPS
            );
    }

    /// @notice Closed-session spread: base + per started hour, capped.
    function closedSpreadBps(uint256 age) internal pure returns (uint256) {
        uint256 hoursClosed = age.ceilDiv(C.SECONDS_PER_HOUR);
        return Math.min(C.CLOSED_BASE_SPREAD_BPS + hoursClosed * C.CLOSED_SPREAD_BPS_PER_HOUR, C.CLOSED_SPREAD_CAP_BPS);
    }

    /// @notice Impact only when |skew| grows: IMPACT_K × Δ|skew| / depth, rounded up.
    function impactBps(int256 skewBefore, int256 skewAfter, uint256 poolUsd6) internal pure returns (uint256) {
        uint256 before = _abs(skewBefore);
        uint256 afterAbs = _abs(skewAfter);
        if (afterAbs <= before) return 0;
        uint256 depth = bpsDown(poolUsd6, C.DEPTH_POOL_BPS);
        if (depth == 0) return type(uint256).max;
        return (afterAbs - before).mulDiv(C.IMPACT_K_BPS, depth, Math.Rounding.Ceil);
    }

    /// @notice Borrow owed = ⌈N_entry × Δ borrowIndex / 1e18⌉ (usd6).
    function borrowOwed(uint256 entryNotional, uint256 index, uint256 snap) internal pure returns (uint256) {
        if (index <= snap) return 0;
        return entryNotional.mulDiv(index - snap, C.WAD, Math.Rounding.Ceil);
    }

    /// @notice Funding owed = σ × N_entry × Δ fundingIndex / 1e18; positive = the account pays.
    /// Payments round up, receipts round down.
    function fundingOwed(bool isLong, uint256 entryNotional, int256 index, int256 snap) internal pure returns (int256) {
        int256 delta = index - snap;
        if (!isLong) delta = -delta;
        if (delta >= 0) return entryNotional.mulDiv(uint256(delta), C.WAD, Math.Rounding.Ceil).toInt256();
        return -entryNotional.mulDiv(uint256(-delta), C.WAD, Math.Rounding.Floor).toInt256();
    }

    /// @notice Funding rate = clamp(factor × (L − S) / max(L + S, MIN_OI), ±MAX_FUNDING_RATE); longs pay when > 0.
    function fundingRate(uint256 longUsd6, uint256 shortUsd6, uint256 factor) internal pure returns (int256) {
        uint256 total = Math.max(longUsd6 + shortUsd6, C.MIN_OI_USD6);
        uint256 skew = longUsd6 > shortUsd6 ? longUsd6 - shortUsd6 : shortUsd6 - longUsd6;
        uint256 rate = Math.min(factor.mulDiv(skew, total), C.MAX_FUNDING_RATE);
        return longUsd6 >= shortUsd6 ? rate.toInt256() : -rate.toInt256();
    }

    /// @notice Borrow rate = base + slope × utilisation (utilisation = open notional / pool, 1e18, capped at 1).
    function borrowRate(uint256 openUsd6, uint256 poolUsd6, uint256 base, uint256 slope)
        internal
        pure
        returns (uint256)
    {
        uint256 util = poolUsd6 == 0 ? C.WAD : Math.min(openUsd6.mulDiv(C.WAD, poolUsd6), C.WAD);
        return base + slope.mulDiv(util, C.WAD);
    }

    function _abs(int256 x) private pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }
}
