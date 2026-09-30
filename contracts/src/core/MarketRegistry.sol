// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {MarketParams} from "../libraries/Types.sol";
import {CollateralConfig} from "./CollateralConfig.sol";

/// @title MarketRegistry — per-market risk parameters.
/// @notice `setMarketParams`/`addMarket` are PARAM_ADMIN (timelocked by the AccessManager execution delay);
/// the `lower*`/`raise*`/`disable` family is GUARDIAN (instant) and may only reduce risk.
abstract contract MarketRegistry is CollateralConfig {
    function addMarket(MarketParams calldata params) external restricted returns (uint8 marketId) {
        return _addMarket(params);
    }

    function setMarketParams(uint8 marketId, MarketParams calldata params) external restricted {
        _requireMarket(marketId);
        _validate(params);
        _markets[marketId] = params;
        emit Events.MarketConfigured(marketId, params.enabled);
    }

    /// @notice GUARDIAN: lower OI / trade / skew caps and the profit cap.
    function lowerCaps(
        uint8 marketId,
        uint128 oiCapAbsUsd6,
        uint16 oiCapPoolBps,
        uint16 skewCapPoolBps,
        uint16 tradeCapPoolBps,
        uint16 maxProfitBps
    ) external restricted {
        MarketParams storage m = _requireMarket(marketId);
        if (
            oiCapAbsUsd6 > m.oiCapAbsUsd6 || oiCapPoolBps > m.oiCapPoolBps || skewCapPoolBps > m.skewCapPoolBps
                || tradeCapPoolBps > m.tradeCapPoolBps || maxProfitBps > m.maxProfitBps
        ) revert Errors.NotRiskReducing();
        m.oiCapAbsUsd6 = oiCapAbsUsd6;
        m.oiCapPoolBps = oiCapPoolBps;
        m.skewCapPoolBps = skewCapPoolBps;
        m.tradeCapPoolBps = tradeCapPoolBps;
        m.maxProfitBps = maxProfitBps;
        emit Events.MarketConfigured(marketId, m.enabled);
    }

    /// @notice GUARDIAN: raise margins, fee or spreads.
    function raiseMargins(uint8 marketId, uint16 imBps, uint16 mmBps, uint16 baseSpreadBps, uint16 devSpreadBps)
        external
        restricted
    {
        MarketParams storage m = _requireMarket(marketId);
        if (
            imBps < m.imBps || mmBps < m.mmBps || baseSpreadBps < m.baseSpreadBps || devSpreadBps < m.devSpreadBps
                || mmBps >= imBps || imBps > C.BPS
        ) revert Errors.NotRiskReducing();
        m.imBps = imBps;
        m.mmBps = mmBps;
        m.baseSpreadBps = baseSpreadBps;
        m.devSpreadBps = devSpreadBps;
        emit Events.MarketConfigured(marketId, m.enabled);
    }

    /// @notice GUARDIAN: make a market reduce-only (re-enabling goes through `setMarketParams`).
    function disableMarket(uint8 marketId) external restricted {
        _requireMarket(marketId).enabled = false;
        emit Events.MarketConfigured(marketId, false);
    }

    function marketParams(uint8 marketId) external view returns (MarketParams memory) {
        return _markets[marketId];
    }

    function _addMarket(MarketParams memory params) internal returns (uint8 marketId) {
        if (marketCount >= C.MAX_MARKETS) revert Errors.TooManyMarkets();
        _validate(params);
        marketId = marketCount++;
        _markets[marketId] = params;
        _marketState[marketId].lastAccrual = uint64(block.timestamp);
        emit Events.MarketConfigured(marketId, params.enabled);
    }

    function _requireMarket(uint8 marketId) internal view returns (MarketParams storage m) {
        if (marketId >= marketCount) revert Errors.UnknownMarket(marketId);
        m = _markets[marketId];
    }

    function _validate(MarketParams memory p) private pure {
        if (
            p.imBps == 0 || p.imBps > C.BPS || p.mmBps == 0 || p.mmBps >= p.imBps || p.feeBps > C.BPS
                || p.maxProfitBps == 0 || p.oiCapPoolBps > C.BPS || p.skewCapPoolBps > C.BPS
                || p.tradeCapPoolBps > C.BPS || p.baseSpreadBps >= C.BPS || p.devSpreadBps >= C.BPS
        ) revert Errors.InvalidParams();
    }
}
