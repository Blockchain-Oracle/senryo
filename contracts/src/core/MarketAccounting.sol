// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Events} from "../libraries/Events.sol";
import {PerpMath} from "../libraries/PerpMath.sol";
import {Book, MarketParams, MarketState, MarketStatus, Position, PriceView} from "../libraries/Types.sol";
import {MarketRegistry} from "./MarketRegistry.sol";

/// @title MarketAccounting — O(1) per-market aggregates, lazy funding/borrow accrual and pool valuation.
/// @notice Funding and borrow are charged on entry notional (N_entry). Funding accrues only while the market is OPEN
/// at accrual time; keepers `poke` markets so each interval is accrued under its own status.
abstract contract MarketAccounting is MarketRegistry {
    using SafeCast for uint256;
    using SafeCast for int256;

    /// @notice Permissionless: observe the oracle and accrue funding/borrow for one market.
    function poke(uint8 marketId) external nonReentrant {
        _requireMarket(marketId);
        PriceView memory pv = ORACLE.observe(marketId);
        _accrue(marketId, pv.status == MarketStatus.OPEN);
    }

    function marketState(uint8 marketId) external view returns (MarketState memory) {
        return _marketState[marketId];
    }

    /// @notice LP valuation (usd6). `poolFavourable` (mint) = cash + receivables − trader PnL;
    /// conservative (redeem) = cash − max(trader PnL, 0). Both floor at 0.
    function poolValue(bool poolFavourable) public view returns (uint256) {
        int256 value = _bookTotal(Book.POOL).toInt256();
        for (uint8 id; id < marketCount; ++id) {
            PriceView memory pv = ORACLE.peek(id);
            if (pv.price18 == 0) continue;
            int256 pnl = _traderPnl(id, pv.price18);
            if (poolFavourable) value += _receivables(id) - pnl;
            else if (pnl > 0) value -= pnl;
        }
        return value > 0 ? uint256(value) : 0;
    }

    function allMarketsOpen() external view returns (bool) {
        return ORACLE.allOpen();
    }

    // ---------------------------------------------------------------- accrual

    function _accrue(uint8 marketId, bool open) internal {
        MarketState storage s = _marketState[marketId];
        uint256 dt = block.timestamp - s.lastAccrual;
        if (dt == 0) return;
        MarketParams storage m = _markets[marketId];
        uint256 longN = s.longNotional;
        uint256 shortN = s.shortNotional;
        uint256 bRate = PerpMath.borrowRate(longN + shortN, _bookTotal(Book.POOL), m.borrowBase, m.borrowSlope);
        s.borrowIndex += bRate * dt;
        int256 fRate;
        if (open) {
            fRate = PerpMath.fundingRate(longN, shortN, m.fundingFactor);
            s.fundingIndex += fRate * dt.toInt256();
        }
        s.lastAccrual = uint64(block.timestamp);
        emit Events.MarketStateUpdated(marketId, s.longSize, s.shortSize, s.fundingIndex, s.borrowIndex, fRate, bRate);
    }

    // ---------------------------------------------------------------- aggregates

    function _addAggregate(uint8 marketId, Position memory p) internal {
        if (p.size == 0) return;
        MarketState storage s = _marketState[marketId];
        uint256 n = PerpMath.notional(p.size, p.entry);
        uint256 e18 = _entry18(p);
        if (p.isLong) {
            s.longSize += p.size;
            s.longEntry18 += e18;
            s.longNotional += n.toUint128();
            s.longFundingSnapSum += n.toInt256() * p.fundingSnap;
        } else {
            s.shortSize += p.size;
            s.shortEntry18 += e18;
            s.shortNotional += n.toUint128();
            s.shortFundingSnapSum += n.toInt256() * p.fundingSnap;
        }
        s.borrowSnapSum += n * p.borrowSnap;
    }

    function _removeAggregate(uint8 marketId, Position memory p) internal {
        if (p.size == 0) return;
        MarketState storage s = _marketState[marketId];
        uint256 n = PerpMath.notional(p.size, p.entry);
        uint256 e18 = _entry18(p);
        if (p.isLong) {
            s.longSize -= p.size;
            s.longEntry18 -= e18;
            s.longNotional -= n.toUint128();
            s.longFundingSnapSum -= n.toInt256() * p.fundingSnap;
        } else {
            s.shortSize -= p.size;
            s.shortEntry18 -= e18;
            s.shortNotional -= n.toUint128();
            s.shortFundingSnapSum -= n.toInt256() * p.fundingSnap;
        }
        s.borrowSnapSum -= n * p.borrowSnap;
    }

    // ---------------------------------------------------------------- pool maths

    /// @notice Trader aggregate PnL (usd6) = (L·P − longEntry) + (shortEntry − S·P), O(1).
    function _traderPnl(uint8 marketId, uint256 price18) internal view returns (int256) {
        MarketState storage s = _marketState[marketId];
        int256 longPnl = Math.mulDiv(s.longSize, price18, C.WAD).toInt256() - s.longEntry18.toInt256();
        int256 shortPnl = s.shortEntry18.toInt256() - Math.mulDiv(s.shortSize, price18, C.WAD).toInt256();
        return (longPnl + shortPnl) / int256(C.NOTIONAL_SCALE / C.WAD);
    }

    /// @notice Funding + borrow owed to the pool at the stored indexes (usd6, may be negative for funding).
    function _receivables(uint8 marketId) internal view returns (int256) {
        MarketState storage s = _marketState[marketId];
        int256 wad = int256(C.WAD);
        uint256 openN = uint256(s.longNotional) + s.shortNotional;
        int256 borrow = ((openN * s.borrowIndex).toInt256() - s.borrowSnapSum.toInt256()) / wad;
        int256 longF = (int256(uint256(s.longNotional)) * s.fundingIndex - s.longFundingSnapSum) / wad;
        int256 shortF = (int256(uint256(s.shortNotional)) * s.fundingIndex - s.shortFundingSnapSum) / wad;
        return borrow + longF - shortF;
    }

    /// @notice Σ reserved max profit over all markets (I4 left-hand side).
    function _reservedProfit() internal view returns (uint256 total) {
        for (uint8 id; id < marketCount; ++id) {
            MarketState storage s = _marketState[id];
            total += PerpMath.bpsUp(uint256(s.longNotional) + s.shortNotional, _markets[id].maxProfitBps);
        }
    }

    function _entry18(Position memory p) internal pure returns (uint256) {
        return Math.mulDiv(p.size, p.entry, C.WAD);
    }
}
