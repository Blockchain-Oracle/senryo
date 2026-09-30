// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AggregatorV3Interface} from "../oracle/interfaces/AggregatorV3Interface.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {Account, CollateralCfg} from "../libraries/Types.sol";
import {CoreStorage} from "./CoreStorage.sol";

/// @title CollateralConfig — per-token haircut, USD feed and depeg floor (D-009: AUSD primary, USDC small haircut).
/// @notice v_t = ⌊bal × min(p, 1) × (BPS − h) / BPS⌋. Below the depeg floor, v_t = 0 for initial checks and the true
/// price for liquidation. A token without a feed is valued at par; an invalid or stale feed counts as depegged
/// for initial checks and at par for liquidation (never liquidate on a broken stablecoin feed).
abstract contract CollateralConfig is CoreStorage {
    /// @notice Configure a collateral token (PARAM_ADMIN, timelocked). Only AUSD and USDC exist in `Account`.
    function setCollateral(address token, CollateralCfg calldata cfg) external restricted {
        _setCollateral(token, cfg);
    }

    /// @notice Raise a haircut instantly (GUARDIAN; risk-reducing only).
    function raiseHaircut(address token, uint16 haircutBps) external restricted {
        CollateralCfg storage cfg = _collateral[token];
        if (haircutBps < cfg.haircutBps || haircutBps > C.BPS) revert Errors.NotRiskReducing();
        cfg.haircutBps = haircutBps;
        emit Events.CollateralConfigured(token, cfg.enabled, haircutBps, cfg.usdFeed);
    }

    function collateralConfig(address token) external view returns (CollateralCfg memory) {
        return _collateral[token];
    }

    /// @notice Adjusted collateral value (usd6) for initial (`forInit`) or liquidation checks.
    function _collateralValue(Account storage a, bool forInit) internal view returns (uint256) {
        return _tokenValue(AUSD, a.ausd, forInit) + _tokenValue(USDC, a.usdc, forInit);
    }

    function _tokenValue(address token, uint256 balance, bool forInit) internal view returns (uint256) {
        if (balance == 0) return 0;
        CollateralCfg memory cfg = _collateral[token];
        if (!cfg.enabled && forInit) return 0;
        (bool ok, uint256 price18) = _stablePrice(cfg);
        if (!ok) {
            if (forInit) return 0;
            price18 = C.WAD;
        }
        if (forInit && price18 < cfg.depegFloor18) return 0;
        uint256 p = Math.min(price18, C.WAD);
        uint256 value = Math.mulDiv(balance, p, C.WAD);
        return Math.mulDiv(value, C.BPS - cfg.haircutBps, C.BPS);
    }

    function _stablePrice(CollateralCfg memory cfg) internal view returns (bool ok, uint256 price18) {
        if (cfg.usdFeed == address(0)) return (true, C.WAD);
        AggregatorV3Interface feed = AggregatorV3Interface(cfg.usdFeed);
        try feed.latestRoundData() returns (uint80 rid, int256 answer, uint256, uint256 at, uint80 air) {
            if (answer <= 0 || at > block.timestamp || air < rid) return (false, 0);
            if (block.timestamp - at > uint256(cfg.feedHeartbeat) + C.FEED_GRACE) return (false, 0);
            uint8 dec = feed.decimals();
            if (dec > C.PRICE_DECIMALS) return (false, 0);
            // forge-lint: disable-next-line(unsafe-typecast)
            price18 = uint256(answer) * C.DECIMAL_BASE ** (C.PRICE_DECIMALS - dec);
            ok = true;
        } catch {
            return (false, 0);
        }
    }

    function _setCollateral(address token, CollateralCfg memory cfg) internal {
        if (token != AUSD && token != USDC) revert Errors.UnsupportedToken(token);
        if (cfg.haircutBps > C.BPS || cfg.depegFloor18 > C.WAD) revert Errors.InvalidParams();
        _collateral[token] = cfg;
        emit Events.CollateralConfigured(token, cfg.enabled, cfg.haircutBps, cfg.usdFeed);
    }
}
