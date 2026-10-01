// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {SessionOracle} from "../src/oracle/SessionOracle.sol";
import {AggregatorV3Interface} from "../src/oracle/interfaces/AggregatorV3Interface.sol";
import {Constants as C} from "../src/libraries/Constants.sol";
import {MarketParams} from "../src/libraries/Types.sol";
import {SeedConstants as S} from "./SeedConstants.sol";

/// @title FxListing — the five FX majors (S8.23, D-186…D-188) as one list, shared by `Deploy.s.sol` (mainnet, at
/// construction) and `AddMarkets.s.sol` (testnet, timelocked). Market ids 2…6 follow gold (0) and silver (1); the
/// order here is the `addMarket` order, so SenryoCore and SessionOracle ids always agree.
library FxListing {
    struct Market {
        uint8 marketId;
        string symbol;
        string description;
        address mainnetFeed;
        string externalName;
        string mirrorName;
        int256 mirrorSeedAnswer;
        MarketParams params;
    }

    error FxExposureAboveShare(uint256 capsUsd6, uint256 shareUsd6, uint256 poolBps);
    error CapAboveOpenInterestCap(uint8 marketId);
    error DuplicateParams(uint8 marketId);

    function markets() internal pure returns (Market[] memory m) {
        m = new Market[](S.FX_MARKET_COUNT);
        m[0] = Market(
            S.EUR_MARKET,
            "EUR",
            S.EUR_DESCRIPTION,
            S.MAINNET_EUR_USD,
            "EUR_USD",
            "MirrorEUR",
            S.EUR_MIRROR_SEED_ANSWER,
            S.fxParams(false, S.EUR_OI_CAP_POOL_BPS, S.EUR_OI_CAP_ABS_USD6, S.FX_TRADE_CAP_POOL_BPS)
        );
        m[1] = Market(
            S.GBP_MARKET,
            "GBP",
            S.GBP_DESCRIPTION,
            S.MAINNET_GBP_USD,
            "GBP_USD",
            "MirrorGBP",
            S.GBP_MIRROR_SEED_ANSWER,
            S.fxParams(false, S.GBP_OI_CAP_POOL_BPS, S.GBP_OI_CAP_ABS_USD6, S.FX_TRADE_CAP_POOL_BPS)
        );
        m[2] = Market(
            S.JPY_MARKET,
            "JPY",
            S.JPY_DESCRIPTION,
            S.MAINNET_JPY_USD,
            "JPY_USD",
            "MirrorJPY",
            S.JPY_MIRROR_SEED_ANSWER,
            S.fxParams(true, S.JPY_OI_CAP_POOL_BPS, S.JPY_OI_CAP_ABS_USD6, S.FX_TRADE_CAP_POOL_BPS)
        );
        m[3] = Market(
            S.CHF_MARKET,
            "CHF",
            S.CHF_DESCRIPTION,
            S.MAINNET_CHF_USD,
            "CHF_USD",
            "MirrorCHF",
            S.CHF_MIRROR_SEED_ANSWER,
            S.fxParams(true, S.CHF_OI_CAP_POOL_BPS, S.CHF_OI_CAP_ABS_USD6, S.CHF_OI_CAP_POOL_BPS)
        );
        m[4] = Market(
            S.CAD_MARKET,
            "CAD",
            S.CAD_DESCRIPTION,
            S.MAINNET_CAD_USD,
            "CAD_USD",
            "MirrorCAD",
            S.CAD_MIRROR_SEED_ANSWER,
            S.fxParams(false, S.CAD_OI_CAP_POOL_BPS, S.CAD_OI_CAP_ABS_USD6, S.CAD_OI_CAP_POOL_BPS)
        );
    }

    /// @notice SessionOracle feed entry on the FX calendar. `heartbeat` = FX_HEARTBEAT (mainnet Chainlink) or
    /// FX_MIRROR_HEARTBEAT (testnet mirrors).
    function feedInit(Market memory m, address feed, uint32 heartbeat)
        internal
        pure
        returns (SessionOracle.FeedInit memory)
    {
        return SessionOracle.FeedInit({
            marketId: m.marketId,
            feed: AggregatorV3Interface(feed),
            descriptionHash: keccak256(bytes(m.description)),
            calendarId: S.FX_CALENDAR,
            heartbeat: heartbeat,
            clampBps: S.CLAMP_BPS,
            reopenClampBps: S.REOPEN_CLAMP_BPS
        });
    }

    /// @notice D-187: Σ per-side OI caps (abs) ≤ FX_EXPOSURE_SHARE_BPS of the LP seed and Σ pool-bps caps ≤ the same
    /// share of the pool, so correlated USD exposure across the five books stays bounded without a core change. Also
    /// every market's params are distinct: identical `addMarket` calldata shares one AccessManager op id, so the
    /// second of two identical ops could not be scheduled.
    function assertExposureWithinShare() internal pure {
        Market[] memory m = markets();
        uint256 absSum;
        uint256 bpsSum;
        for (uint256 i; i < m.length; ++i) {
            MarketParams memory p = m[i].params;
            absSum += p.oiCapAbsUsd6;
            bpsSum += p.oiCapPoolBps;
            if (p.skewCapPoolBps > p.oiCapPoolBps || p.tradeCapPoolBps > p.oiCapPoolBps) {
                revert CapAboveOpenInterestCap(m[i].marketId);
            }
            for (uint256 j; j < i; ++j) {
                if (keccak256(abi.encode(p)) == keccak256(abi.encode(m[j].params))) {
                    revert DuplicateParams(m[i].marketId);
                }
            }
        }
        uint256 share = S.LP_SEED_USD6 * S.FX_EXPOSURE_SHARE_BPS / C.BPS;
        if (absSum > share || bpsSum > S.FX_EXPOSURE_SHARE_BPS) revert FxExposureAboveShare(absSum, share, bpsSum);
    }
}
