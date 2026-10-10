// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// New for rides (D-299, D-307; 07 §2.5, §2.6, §2.10). A knock-out or cap-out is proven at any recorded print after the
// ride's last change: it pays the same whichever crossing print is used, so a past print is safe here (unlike a fill).
// Earn marks open rides from the side sums, and the bound frontier proves no ride is past a bound at the mark.

import {LinearBook} from "./LinearBook.sol";
import {LinearMath} from "./LinearMath.sol";
import "./MarketTypes.sol";
import "./RideTypes.sol";

/// @title RideBounds — knock-outs, cap-outs, ends of life, rides' exits, and the mark Earn rolls on.
abstract contract RideBounds is LinearBook {
    // ------------------------------------------------------------------------------------------------ bounds

    /// @notice Settles every ride in `ids` whose bound the unique print of `t` crossed (recorded here if missing; send
    ///         its fee only then): knocked out (the rider gets nothing, the caller the keeper fee) or capped (the rider
    ///         gets margin + reserve less the close fee). `t` must be at or after the ride's last fill or close and
    ///         before its end. Permissionless; rides not crossed are skipped. A batch is one market.
    function settleBounds(uint40 t, uint256[] calldata ids, bytes calldata proof) external payable nonReentrant {
        if (ids.length == 0 || ids.length > MAX_RIDE_BATCH) revert BadBatch();
        uint16 marketId = _ride(ids[0]).marketId;
        RideMarket storage m = _rideMarkets[marketId];
        int64 p = windows.ensurePrint{value: msg.value}(m.verifier, m.feedId, t, proof).priceE8;
        for (uint256 i; i < ids.length; ++i) {
            Ride storage r = _ride(ids[i]);
            if (r.marketId != marketId) revert MixedBatch(ids[i]);
            if (r.status != RIDE_OPEN || t < r.updatedAt || t > r.filledAt + m.maxLifeSec) continue;
            if (LinearMath.pastKo(r.isLong, p, r.koE8)) {
                _clearPending(ids[i], r, t);
                _knockOut(ids[i], r, p, msg.sender);
            } else if (LinearMath.pastCap(r.isLong, p, r.capE8)) {
                _clearPending(ids[i], r, t);
                _settleWhole(ids[i], r, p, RIDE_CAPPED, false);
            }
        }
        _assertSolvent();
    }

    /// @notice Settles every ride in `ids` whose life ends at `end` (its fill + the market's life) at that print:
    ///         its bound if the print crossed one, else its equity there. Permissionless.
    function settleEnds(uint40 end, uint256[] calldata ids, bytes calldata proof) external payable nonReentrant {
        if (ids.length == 0 || ids.length > MAX_RIDE_BATCH) revert BadBatch();
        uint16 marketId = _ride(ids[0]).marketId;
        RideMarket storage m = _rideMarkets[marketId];
        int64 p = windows.ensurePrint{value: msg.value}(m.verifier, m.feedId, end, proof).priceE8;
        for (uint256 i; i < ids.length; ++i) {
            Ride storage r = _ride(ids[i]);
            if (r.marketId != marketId) revert MixedBatch(ids[i]);
            if (r.status != RIDE_OPEN || r.filledAt + m.maxLifeSec != end) continue;
            _clearPending(ids[i], r, end);
            if (LinearMath.pastKo(r.isLong, p, r.koE8)) _knockOut(ids[i], r, p, msg.sender);
            else if (LinearMath.pastCap(r.isLong, p, r.capE8)) _settleWhole(ids[i], r, p, RIDE_CAPPED, false);
            else _settleWhole(ids[i], r, p, RIDE_ENDED, false);
        }
        _assertSolvent();
    }

    /// @dev A bound or the end supersedes a pending close (the first valid transaction wins, 07 §2.5).
    function _clearPending(uint256 id, Ride storage r, uint40 t) private {
        if (r.closing != 0) emit RideCloseRefused(id, REFUSE_WINDOW);
        (r.closing, r.limitE8, r.target) = (0, 0, t);
        _exits[_rideKey(id)].firing = EXIT_NONE;
    }

    // ------------------------------------------------------------------------------------------------ the frontier

    /// @notice Tightens a side's frontier to its open rides' exact bounds. `ids` must be every open ride of the side,
    ///         ascending (the count proves none is missing). Permissionless; clears a stale edge before an Earn roll.
    function refreshFrontier(uint16 marketId, uint8 side, uint256[] calldata ids) external {
        RideSide storage s = _sides[marketId][side];
        if (ids.length != s.count) revert BadFrontier(marketId, side);
        bool isLong = side == SIDE_LONG;
        (int64 ko, int64 cap) = (0, 0);
        uint256 last;
        for (uint256 i; i < ids.length; ++i) {
            Ride storage r = _ride(ids[i]);
            if (ids[i] <= last || r.status != RIDE_OPEN || r.marketId != marketId || r.isLong != isLong) {
                revert BadFrontier(marketId, side);
            }
            last = ids[i];
            if (i == 0) (ko, cap) = (r.koE8, r.capE8);
            if (isLong ? r.koE8 > ko : r.koE8 < ko) ko = r.koE8;
            if (isLong ? r.capE8 < cap : r.capE8 > cap) cap = r.capE8;
        }
        (s.koEdgeE8, s.capEdgeE8) = (ko, cap);
        emit FrontierRefreshed(marketId, side, ko, cap);
    }

    /// @notice What every open ride is worth to its riders at the recorded prints of instant `t` (positive: the pool
    ///         owes them), exactly — reverting if any side's frontier reaches a bound at its print, where a ride may be
    ///         past its knock-out or cap and the sums no longer equal the clamped values. Earn's roll uses it (D-307).
    function markRides(uint40 t) public view returns (int256 owed) {
        uint256 n = _rideMarkets.length;
        for (uint256 i; i < n; ++i) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint16 id = uint16(i);
            RideSide storage longs = _sides[id][SIDE_LONG];
            RideSide storage shorts = _sides[id][SIDE_SHORT];
            if (longs.count == 0 && shorts.count == 0) continue;
            RideMarket storage m = _rideMarkets[i];
            Print memory print = windows.printOf(m.verifier, m.feedId, t);
            if (print.publishTime == 0) revert PastBound(id, SIDES);
            int64 p = print.priceE8;
            if (longs.count != 0) {
                if (p <= longs.koEdgeE8 || p >= longs.capEdgeE8) revert PastBound(id, SIDE_LONG);
                owed += LinearMath.sidePnl(true, longs.size, longs.cost, p);
            }
            if (shorts.count != 0) {
                if (p >= shorts.koEdgeE8 || p <= shorts.capEdgeE8) revert PastBound(id, SIDE_SHORT);
                owed += LinearMath.sidePnl(false, shorts.size, shorts.cost, p);
            }
        }
    }

    /// @notice Whether any ride is open (Earn needs no ride print when none is).
    function ridesOpen() external view returns (bool) {
        for (uint256 i; i < _rideMarkets.length; ++i) {
            // forge-lint: disable-next-line(unsafe-typecast)
            if (_sides[uint16(i)][SIDE_LONG].count + _sides[uint16(i)][SIDE_SHORT].count != 0) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------------------------------------ exits

    /// @notice Sets, replaces or (every level 0) clears a ride's exit (prices × 1e8; the trail a distance in bps).
    function setRideExit(ExitOrder calldata o, bytes calldata sig) external nonReentrant {
        if (o.book != BOOK_RIDE) revert BadExit();
        Ride storage r = _ride(o.id);
        if (r.owner != o.owner) revert NotRideOwner(o.id, o.owner);
        if (r.status != RIDE_COMMITTED && r.status != RIDE_OPEN) revert RideNotOpen(o.id, r.status);
        if (r.closing != 0) revert RideClosePending(o.id);
        _takeExit(o, sig, _validRideExit(o, r.isLong));
    }

    /// @notice Closes the whole ride at the next print if it meets the take-profit or the stop-loss; anyone may
    ///         fire it, and a miss leaves the exit standing.
    function fireRideExit(uint256 id) external nonReentrant {
        Exit storage e = _exits[_rideKey(id)];
        if (e.takeProfit == 0 && e.stopLoss == 0) revert NoExit(BOOK_RIDE, id);
        _fireRide(id, e, EXIT_PRICE);
    }

    /// @notice The trail: the exit keeper's ratcheting stop decides when (restricted); the fill still needs the floor.
    function fireRideTrail(uint256 id) external restricted nonReentrant {
        Exit storage e = _exits[_rideKey(id)];
        if (e.trail == 0) revert NoExit(BOOK_RIDE, id);
        _fireRide(id, e, EXIT_TRAIL);
    }

    function _fireRide(uint256 id, Exit storage e, uint8 kind) private {
        Ride storage r = _ride(id);
        if (e.epoch != epochOf[r.owner]) revert ExitRevoked(BOOK_RIDE, id);
        _checkRideClosable(id, r);
        e.firing = kind;
        uint40 target = _pendRideClose(r, r.size, r.isLong ? int64(1) : type(int64).max);
        emit RideCloseCommitted(id, r.size, r.limitE8, target, false);
        emit ExitFired(BOOK_RIDE, id, kind, target, msg.sender);
    }

    /// @dev Prices fit a print; the trail is at most the whole price; take-profit beyond the stop on the ride's side.
    function _validRideExit(ExitOrder calldata o, bool isLong) private pure returns (bool) {
        uint64 maxPrice = uint64(type(int64).max);
        if (o.takeProfit > maxPrice || o.stopLoss > maxPrice || o.floor > maxPrice || o.trail > BPS) return false;
        if (o.takeProfit == 0 || o.stopLoss == 0) return true;
        return isLong ? o.takeProfit > o.stopLoss : o.takeProfit < o.stopLoss;
    }

    function _rideKey(uint256 id) internal pure override returns (uint256) {
        return exitKey(BOOK_RIDE, id);
    }

    /// @dev Take-profit at a print at or past it, stop-loss at or past it (toward the knock-out), the trail at a print
    ///      on the rider's side of their floor (no floor: any print).
    function _rideExitMet(Exit storage e, bool isLong, int64 p) internal view override returns (bool) {
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 x = uint64(p);
        if (e.takeProfit != 0 && (isLong ? x >= e.takeProfit : x <= e.takeProfit)) return true;
        if (e.stopLoss != 0 && (isLong ? x <= e.stopLoss : x >= e.stopLoss)) return true;
        if (e.firing != EXIT_TRAIL) return false;
        return e.floor == 0 || (isLong ? x >= e.floor : x <= e.floor);
    }
}
