// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Rounding from the removed engine's PerpMath (`git show cd37e193^:contracts/src/libraries/PerpMath.sol`): every
// rounding goes against the account — gains floor, losses ceil, charges ceil, allowances floor. New for rides (D-299,
// 07 §2.2): isolated positions with a reserved cap, a knock-out and a cap-out fixed at the fill. Mirrored bit for bit by
// `packages/core/src/market/ride-math.ts` with shared vectors.

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "./MarketTypes.sol";
import "./RideTypes.sol";

/// @title LinearMath — what a ride is, is worth, and pays.
/// @dev Prices × 1e8 (positive), money in collateral units, size × `RIDE_SCALE`.
library LinearMath {
    using Math for uint256;

    /// @notice The ride's exposure: margin × leverage, floored.
    function notional(uint256 margin, uint256 leverageBps) internal pure returns (uint256) {
        return margin * leverageBps / BPS;
    }

    /// @notice Size bought with `notional_` at `entryE8`, floored (less size for the account).
    function sizeOf(uint256 notional_, int64 entryE8) internal pure returns (uint256) {
        return notional_.mulDiv(RIDE_SCALE, _p(entryE8));
    }

    /// @notice The most the ride can win — the pool's reserve: margin × min(maxProfit, leverage × maxMove), floored.
    function reserveOf(uint256 margin, uint256 leverageBps, uint256 maxProfitBps, uint256 maxMoveBps)
        internal
        pure
        returns (uint256)
    {
        uint256 moveBps = leverageBps * maxMoveBps / BPS;
        return margin * Math.min(maxProfitBps, moveBps) / BPS;
    }

    /// @notice PnL of `size` from `entryE8` to `exitE8`: gains floor, losses ceil.
    function pnl(bool isLong, uint256 size, int64 entryE8, int64 exitE8) internal pure returns (int256) {
        uint256 entry = _p(entryE8);
        uint256 exit = _p(exitE8);
        bool gain = isLong ? exit > entry : exit < entry;
        uint256 diff = exit > entry ? exit - entry : entry - exit;
        if (gain) return int256(size.mulDiv(diff, RIDE_SCALE));
        return -int256(size.mulDiv(diff, RIDE_SCALE, Math.Rounding.Ceil));
    }

    /// @notice What the ride is worth to its owner at a PnL: margin + PnL, never below 0 nor above margin + reserve.
    function equity(uint256 margin, uint256 reserve, int256 pnl_) internal pure returns (uint256) {
        if (pnl_ < 0) {
            uint256 loss = uint256(-pnl_);
            return loss >= margin ? 0 : margin - loss;
        }
        return Math.min(margin + uint256(pnl_), margin + reserve);
    }

    /// @notice The knock-out price: where `KO_LOSS_BPS` of the margin is lost. The distance floors, so the line sits
    ///         nearer the entry (against the account).
    function koPrice(bool isLong, int64 entryE8, uint256 size, uint256 margin) internal pure returns (int64) {
        uint256 dist = (margin * KO_LOSS_BPS).mulDiv(RIDE_SCALE, size * BPS);
        return _priceAt(isLong ? -1 : int8(1), entryE8, dist);
    }

    /// @notice The cap-out price: where the PnL reaches the reserve. The distance ceils (further: against the account).
    function capPrice(bool isLong, int64 entryE8, uint256 size, uint256 reserve) internal pure returns (int64) {
        uint256 dist = reserve.mulDiv(RIDE_SCALE, size, Math.Rounding.Ceil);
        return _priceAt(isLong ? int8(1) : -1, entryE8, dist);
    }

    /// @notice Whether a print at `priceE8` is past the ride's knock-out (`ko`) or its cap.
    function pastKo(bool isLong, int64 priceE8, int64 koE8) internal pure returns (bool) {
        return isLong ? priceE8 <= koE8 : priceE8 >= koE8;
    }

    function pastCap(bool isLong, int64 priceE8, int64 capE8) internal pure returns (bool) {
        return isLong ? priceE8 >= capE8 : priceE8 <= capE8;
    }

    /// @notice Notional of `size` at `priceE8`, ceiled (fees are charged on it).
    function notionalAt(uint256 size, int64 priceE8) internal pure returns (uint256) {
        return size.mulDiv(_p(priceE8), RIDE_SCALE, Math.Rounding.Ceil);
    }

    /// @notice A charge of `bps` on `amount`, ceiled.
    function feeOf(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return amount.mulDiv(bps, BPS, Math.Rounding.Ceil);
    }

    /// @notice The early-close fee (D-301): on a profitable close within `window` seconds of the fill, `feeBps` of
    ///         the exit notional falling linearly to 0 over the window, ceiled, never more than the profit.
    function earlyFee(uint256 exitNotional, int256 pnl_, uint256 age, uint256 feeBps, uint256 window)
        internal
        pure
        returns (uint256)
    {
        if (pnl_ <= 0 || age >= window) return 0;
        uint256 fee = exitNotional.mulDiv(feeBps * (window - age), window * BPS, Math.Rounding.Ceil);
        return Math.min(fee, uint256(pnl_));
    }

    /// @notice What the prover of a knock-out takes from the forfeited margin: 2 % of it, at most $5.
    function keeperFee(uint256 margin) internal pure returns (uint256) {
        return Math.min(margin * KO_KEEPER_BPS / BPS, KO_KEEPER_CAP);
    }

    /// @notice A part of a stored amount leaving with `part` of `whole` size, ceiled (the remaining never exceeds its
    ///         share).
    function share(uint256 amount, uint256 part, uint256 whole) internal pure returns (uint256) {
        return amount.mulDiv(part, whole, Math.Rounding.Ceil);
    }

    /// @notice What a market side owes its riders at `priceE8` before any clamp (positive = the riders are up), from
    ///         its sums: long P·Σs − Σ(s·x), short the mirror. Riders' gains ceil (the pool's value never overstated).
    function sidePnl(bool isLong, uint256 size, uint256 cost, int64 priceE8) internal pure returns (int256) {
        uint256 value = size * _p(priceE8);
        bool riderGain = isLong ? value > cost : value < cost;
        uint256 diff = value > cost ? value - cost : cost - value;
        if (riderGain) return int256(diff.ceilDiv(RIDE_SCALE));
        return -int256(diff / RIDE_SCALE);
    }

    function _priceAt(int8 dir, int64 entryE8, uint256 dist) private pure returns (int64) {
        int256 p = int256(entryE8) + int256(dir) * int256(dist);
        // A short's cap (or a long's knock-out) can't go to zero or below: hold it at the smallest price.
        if (p < 1) p = 1;
        // forge-lint: disable-next-line(unsafe-typecast)
        return p > type(int64).max ? type(int64).max : int64(p);
    }

    function _p(int64 priceE8) private pure returns (uint256) {
        if (priceE8 <= 0) revert NonPositiveRidePrice(priceE8);
        return uint256(int256(priceE8));
    }

    error NonPositiveRidePrice(int64 priceE8);
}
