// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// New for rides (D-299, D-301; 07 §2.3, §2.8). The removed engine's aggregates drifted because a snapshot moved between
// adding a position and removing it (D-161, D-182); here every side sum moves only by the values the ride stores, added
// at the fill and taken away at the exit, and an invariant checks sums == Σ rides.

import {LinearMath} from "./LinearMath.sol";
import {SeriesListing} from "./SeriesListing.sol";
import {IRideBook} from "./interfaces/IRideBook.sol";
import "./MarketTypes.sol";
import "./RideTypes.sol";

/// @title RideLedger — ride markets, their side sums and frontier, and how much more risk the pool can take.
abstract contract RideLedger is SeriesListing, IRideBook {
    RideMarket[] internal _rideMarkets;
    mapping(uint16 marketId => RideSide[SIDES]) internal _sides;
    RideTerms public rideTerms;
    /// @notice The hour the loss brake is counting, and the pool's net realised ride loss in it (gains offset).
    uint40 public lossHour;
    int256 public lossThisHour;

    // ------------------------------------------------------------------------------------------------ PARAMS

    /// @notice Lists a ride market (v1: 24/7 Pyth crypto). Its terms, like any pricing change, bump the version.
    function addRideMarket(RideMarket calldata m) external restricted returns (uint16 id) {
        _checkRideMarket(m);
        // forge-lint: disable-next-line(unsafe-typecast)
        id = uint16(_rideMarkets.length);
        _rideMarkets.push(m);
        _bumpRides(id, m);
    }

    function setRideMarket(uint16 id, RideMarket calldata m) external restricted {
        RideMarket storage cur = _rideMarket(id);
        // A market's print source never changes: open rides settle on it.
        if (m.verifier != cur.verifier || m.feedId != cur.feedId) revert BadRideMarket();
        _checkRideMarket(m);
        _rideMarkets[id] = m;
        _bumpRides(id, m);
    }

    function setRideTerms(RideTerms calldata t) external restricted {
        if (t.maxLinearBps == 0 || t.maxLinearBps > MAX_LINEAR_BPS) revert BadRideMarket();
        if (t.maxHourlyLossBps == 0 || t.maxHourlyLossBps > MAX_HOURLY_LOSS_BPS) revert BadRideMarket();
        if (t.earlyFeeBps > MAX_EARLY_FEE_BPS || t.earlyWindowSec > MAX_EARLY_WINDOW_SEC) revert BadRideMarket();
        rideTerms = t;
        configVersion += 1;
        emit RideTermsSet(t, configVersion);
    }

    // ------------------------------------------------------------------------------------------------ views

    function rideMarketOf(uint16 id) external view returns (RideMarket memory) {
        return _rideMarket(id);
    }

    function rideMarketCount() external view returns (uint256) {
        return _rideMarkets.length;
    }

    function rideSideOf(uint16 id, uint8 side) external view returns (RideSide memory) {
        return _sides[id][side];
    }

    // ------------------------------------------------------------------------------------------------ capacity

    /// @dev Whether the pool can take a ride reserving `reserve` on `notional` (07 §2.8): the pool's free liquidity
    ///      and exposure (shared with calls), rides' share of the pool, the market's own reserve cap, the skew cap (a
    ///      trade that reduces skew always passes), the side's count, and the hourly loss brake.
    function _rideFits(uint16 id, bool isLong, uint256 reserve, uint256 notional) internal view returns (bool) {
        if (!_poolCanReserve(reserve)) return false;
        uint256 pool = liquid + reserved;
        RideTerms storage t = rideTerms;
        if ((linearReserved + reserve) * BPS > pool * t.maxLinearBps) return false;
        RideMarket storage m = _rideMarkets[id];
        RideSide storage longSide = _sides[id][SIDE_LONG];
        RideSide storage shortSide = _sides[id][SIDE_SHORT];
        uint256 marketReserve = longSide.reserve + shortSide.reserve + reserve;
        if (marketReserve > m.marketReserveCap || marketReserve * BPS > pool * m.marketReserveBps) return false;
        (uint256 before, uint256 next) = _skewMove(id, isLong, notional);
        if (next > before && next * BPS > pool * m.skewCapBps) return false;
        if (_sides[id][isLong ? SIDE_LONG : SIDE_SHORT].count >= MAX_OPEN_PER_SIDE) return false;
        return !_braking(pool);
    }

    /// @dev |long − short| entry notional in a market before and after adding `notional` to one side.
    function _skewMove(uint16 id, bool isLong, uint256 notional) internal view returns (uint256 before, uint256 next) {
        uint256 longN = _sides[id][SIDE_LONG].cost / RIDE_SCALE;
        uint256 shortN = _sides[id][SIDE_SHORT].cost / RIDE_SCALE;
        before = longN > shortN ? longN - shortN : shortN - longN;
        (uint256 l, uint256 s) = isLong ? (longN + notional, shortN) : (longN, shortN + notional);
        next = l > s ? l - s : s - l;
    }

    /// @dev Whether removing `notional` from a side reduces the market's skew (the maker rate on a close).
    function _closeReducesSkew(uint16 id, bool isLong, uint256 notional) internal view returns (bool) {
        uint256 longN = _sides[id][SIDE_LONG].cost / RIDE_SCALE;
        uint256 shortN = _sides[id][SIDE_SHORT].cost / RIDE_SCALE;
        uint256 before = longN > shortN ? longN - shortN : shortN - longN;
        (uint256 l, uint256 s) =
            isLong ? (longN - _min(notional, longN), shortN) : (longN, shortN - _min(notional, shortN));
        return (l > s ? l - s : s - l) < before;
    }

    /// @dev The brake holds new opens once the pool's net realised ride loss this hour passes its share of the pool
    ///      (the Ostium lesson: a cap per trade is not a cap per hour).
    function _braking(uint256 pool) internal view returns (bool) {
        if (_hourNow() != lossHour) return false;
        return lossThisHour > 0 && uint256(lossThisHour) * BPS > pool * rideTerms.maxHourlyLossBps;
    }

    /// @dev Counts what an exit cost the pool (positive) or earned it (negative) toward this hour's brake.
    function _countLoss(int256 poolLoss) internal {
        uint40 hour = _hourNow();
        if (hour != lossHour) (lossHour, lossThisHour) = (hour, 0);
        lossThisHour += poolLoss;
    }

    // ------------------------------------------------------------------------------------------------ the sums

    /// @dev A fill adds the ride's stored values to its side and widens the frontier to its bounds.
    function _addToSide(Ride storage r) internal {
        RideSide storage side = _sides[r.marketId][r.isLong ? SIDE_LONG : SIDE_SHORT];
        if (side.count == 0) (side.koEdgeE8, side.capEdgeE8) = (r.koE8, r.capE8);
        side.size += r.size;
        side.cost += uint256(r.size) * uint256(int256(r.entryE8));
        side.margin += r.margin;
        side.reserve += r.reserve;
        side.count += 1;
        if (r.isLong) {
            if (r.koE8 > side.koEdgeE8) side.koEdgeE8 = r.koE8;
            if (r.capE8 < side.capEdgeE8) side.capEdgeE8 = r.capE8;
        } else {
            if (r.koE8 < side.koEdgeE8) side.koEdgeE8 = r.koE8;
            if (r.capE8 > side.capEdgeE8) side.capEdgeE8 = r.capE8;
        }
    }

    /// @dev An exit takes exactly the parts leaving the ride from its side; the frontier only resets when the side
    ///      empties (a stale edge is more extreme, so the Earn check stays conservative).
    function _takeFromSide(Ride storage r, uint256 sizeOut, uint256 marginOut, uint256 reserveOut, bool last) internal {
        RideSide storage side = _sides[r.marketId][r.isLong ? SIDE_LONG : SIDE_SHORT];
        // forge-lint: disable-next-line(unsafe-typecast)
        side.size -= uint128(sizeOut);
        side.cost -= sizeOut * uint256(int256(r.entryE8));
        // forge-lint: disable-next-line(unsafe-typecast)
        side.margin -= uint128(marginOut);
        // forge-lint: disable-next-line(unsafe-typecast)
        side.reserve -= uint128(reserveOut);
        if (last) {
            side.count -= 1;
            if (side.count == 0) (side.koEdgeE8, side.capEdgeE8) = (0, 0);
        }
    }

    // ------------------------------------------------------------------------------------------------ helpers

    function _rideMarket(uint16 id) internal view returns (RideMarket storage) {
        if (id >= _rideMarkets.length) revert UnknownRideMarket(id);
        return _rideMarkets[id];
    }

    function _checkRideMarket(RideMarket calldata m) private view {
        bool ok = windows.knownVerifier(m.verifier) && m.feedId != bytes32(0) && m.maxLeverageBps >= MIN_LEVERAGE_BPS
            && m.maxLeverageBps <= MAX_LEVERAGE_BPS && m.takerFeeBps <= MAX_RIDE_FEE_BPS
            && m.makerFeeBps <= m.takerFeeBps && m.maxProfitBps != 0 && m.maxProfitBps <= MAX_PROFIT_BPS
            && m.maxMoveBps != 0 && m.maxMoveBps <= MAX_MOVE_BPS && m.marketReserveBps <= MAX_MARKET_RESERVE_BPS
            && m.skewCapBps <= MAX_SKEW_CAP_BPS && m.maxLifeSec != 0 && m.maxLifeSec <= MAX_RIDE_LIFE_SEC
            && m.minMargin != 0 && m.maxMargin >= m.minMargin;
        if (!ok) revert BadRideMarket();
    }

    function _bumpRides(uint16 id, RideMarket calldata m) private {
        configVersion += 1;
        emit RideMarketSet(id, m.feedId, m.enabled, configVersion);
    }

    function _hourNow() internal view returns (uint40) {
        // forge-lint: disable-next-line(block-timestamp)
        return uint40(block.timestamp - block.timestamp % RIDE_HOUR_SEC);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @dev The rides' ledger moves, mirrored on the pool's buckets (07 §2.9).
    function _bookRideFill(uint256 committed, uint256 margin, uint256 fee, uint256 reserve) internal {
        committedStakes -= committed;
        margins += margin;
        liquid += fee;
        liquid -= reserve;
        reserved += reserve;
        linearReserved += reserve;
    }

    /// @dev `marginOut` and `reserveOut` leave the ride; `paid` goes to its recipient and `keeperFee` to a prover; the
    ///      pool keeps the rest. Returns what the exit cost the pool (negative: earned).
    function _bookRideExit(uint256 marginOut, uint256 reserveOut, uint256 paid, uint256 keeperFee)
        internal
        returns (int256 poolLoss)
    {
        margins -= marginOut;
        reserved -= reserveOut;
        linearReserved -= reserveOut;
        liquid += marginOut + reserveOut - paid - keeperFee;
        poolLoss = int256(paid + keeperFee) - int256(marginOut);
        _countLoss(poolLoss);
    }

    /// @dev The margin of `size` at `entryE8` — for the skew sums, entry notional.
    function _entryNotional(uint256 size, int64 entryE8) internal pure returns (uint256) {
        return LinearMath.notionalAt(size, entryE8);
    }
}
