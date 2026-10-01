// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {CALENDAR_WORD_COUNT} from "../src/libraries/Constants.sol";
import {CollateralCfg, MarketParams} from "../src/libraries/Types.sol";
import {PoolKey} from "../src/periphery/CollateralSwapper.sol";

/// @title SeedConstants — every deploy/seed number (specs/contracts.md "Seed and market constants").
/// @notice Each mainnet use of a seed amount is an [OK?] step. Values marked (D-0xx) were chosen in S2.
library SeedConstants {
    // ---------------------------------------------------------------- chains / external addresses (mainnet 143)
    address internal constant MAINNET_AUSD = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;
    address internal constant MAINNET_USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
    address internal constant MAINNET_XAU_USD = 0x61dD33A34E47a181EE02e42eE0546a3DA808f1B4;
    address internal constant MAINNET_XAG_USD = 0x29bEb7e730f09D33417357dbed020B549fdF7db4;
    address internal constant MAINNET_USDC_USD = 0xf5F15f188AbCB0d165D1Edb7f37F7d6fA2fCebec;
    address internal constant MAINNET_AUSD_USD = 0xE20751C7B5867bCBef815ffc1b284c3f412a9e13;
    address internal constant UNIVERSAL_ROUTER = 0xa6CE4F10d83dBdDAc17E68e1837ca9cE6a1b596e;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    /// @dev Uniswap v4 AUSD/USDC pool read onchain in S3 (D-122): currency0 AUSD < currency1 USDC, fee 50 = 0.005 %,
    /// tick spacing 1, no hooks → poolId 0x092b6504…59ce72. The v4 Quoter and PoolManager are fork-test references.
    uint24 internal constant STABLE_POOL_FEE = 50;
    int24 internal constant STABLE_POOL_TICK_SPACING = 1;
    address internal constant V4_POOL_MANAGER = 0x188d586Ddcf52439676Ca21A244753fA19F9Ea8e;
    address internal constant V4_QUOTER = 0xa222Dd357A9076d1091Ed6Aa2e16C9742dD26891;

    // ---------------------------------------------------------------- feeds
    string internal constant XAU_DESCRIPTION = "XAU / USD";
    string internal constant XAG_DESCRIPTION = "XAG / USD";
    uint8 internal constant FEED_DECIMALS = 8;
    uint32 internal constant METALS_HEARTBEAT = 3600;
    uint32 internal constant STABLE_HEARTBEAT = 86_400;
    /// @dev Testnet mirror seed answers (8 dec); the keeper's first real push trips the clamp and self-confirms
    /// after 3 rounds / 300 s (D-055).
    int256 internal constant XAU_MIRROR_SEED_ANSWER = 3800e8;
    int256 internal constant XAG_MIRROR_SEED_ANSWER = 45e8;
    uint8 internal constant CME_METALS_CALENDAR = 0;
    uint8 internal constant GOLD_MARKET = 0;
    uint8 internal constant SILVER_MARKET = 1;
    uint16 internal constant CLAMP_BPS = 200;
    uint16 internal constant REOPEN_CLAMP_BPS = 500;

    // ---------------------------------------------------------------- FX majors (S8.23, D-186…D-189)
    /// @dev Chainlink FX push feeds on Monad mainnet (reference-data-directory feeds-monad-mainnet.json; description,
    /// decimals and rounds read onchain 2026-09-30): 18 decimals, 240 s heartbeat, 0.15 % deviation threshold.
    /// The quote is the feed's own orientation: JPY / USD is USD per yen (≈ 0.00635), never inverted.
    address internal constant MAINNET_EUR_USD = 0x00D7E359c8CE46168eFDD4D65b708fFb16c4b99a;
    address internal constant MAINNET_GBP_USD = 0x1ffC8B75a16FFfbd7879F042B580F7607Dcf5C30;
    address internal constant MAINNET_JPY_USD = 0xF64664Ea54cE47eCC7a1816C49d1Bc6deF828927;
    address internal constant MAINNET_CHF_USD = 0x6DBa7f3A7B5B7c1079337104caD14D19150F6B8d;
    address internal constant MAINNET_CAD_USD = 0x3293eA5650E9f8c4091642b7EB1C46CFEe5197cA;
    string internal constant EUR_DESCRIPTION = "EUR / USD";
    string internal constant GBP_DESCRIPTION = "GBP / USD";
    string internal constant JPY_DESCRIPTION = "JPY / USD";
    string internal constant CHF_DESCRIPTION = "CHF / USD";
    string internal constant CAD_DESCRIPTION = "CAD / USD";
    uint8 internal constant FX_FEED_DECIMALS = 18;
    /// @dev SessionOracle heartbeat for the mainnet FX feeds: the feeds' 240 s heartbeat plus the largest in-session
    /// gap measured over 7 days (D-186), so a healthy feed never flickers STALE; FEED_GRACE (600 s) comes on top.
    uint32 internal constant FX_HEARTBEAT = 240;
    /// @dev Testnet FX mirrors age by the keeper's FX relay cadence (MIRROR_FX_HEARTBEAT_SEC 9,000 s): FX moves
    /// ≈ 0.5 %/day, and five mirrors at the metals' 3,000 s cadence would burn ≈ 2.1 tMON/day of keeper gas (D-188).
    uint32 internal constant FX_MIRROR_HEARTBEAT = 10_800;
    uint8 internal constant FX_CALENDAR = 1;
    uint8 internal constant EUR_MARKET = 2;
    uint8 internal constant GBP_MARKET = 3;
    uint8 internal constant JPY_MARKET = 4;
    uint8 internal constant CHF_MARKET = 5;
    uint8 internal constant CAD_MARKET = 6;
    uint256 internal constant FX_MARKET_COUNT = 5;
    /// @dev Testnet mirror seed answers (18 dec, ≈ the 30 Sep mainnet answers); the first real push is accepted as
    /// the first price (SessionOracle starts with no accepted price) or self-confirms after 3 rounds (D-055).
    int256 internal constant EUR_MIRROR_SEED_ANSWER = 1.13e18;
    int256 internal constant GBP_MIRROR_SEED_ANSWER = 1.32e18;
    int256 internal constant JPY_MIRROR_SEED_ANSWER = 0.00635e18;
    int256 internal constant CHF_MIRROR_SEED_ANSWER = 1.19e18;
    int256 internal constant CAD_MIRROR_SEED_ANSWER = 0.7e18;

    // ---------------------------------------------------------------- FX risk (D-187)
    /// @dev 20× where the pair's worst modern gaps sit inside MM (EUR, GBP, CAD); 10× for JPY (MoF/BoJ interventions
    /// moved it 2–5 % within an hour in 2022/2024) and CHF (SNB floor removal, Jan 2015).
    uint16 internal constant FX_IM_BPS = 500;
    uint16 internal constant FX_MM_BPS = 250;
    uint16 internal constant FX_GAP_IM_BPS = 1000;
    uint16 internal constant FX_GAP_MM_BPS = 500;
    /// @dev devSpread ≥ the feed's deviation threshold (risk-math.md): 0.15 % → 15 bps each side.
    uint16 internal constant FX_DEV_SPREAD_BPS = 15;
    /// @dev A realised FX profit is capped at 10 % of entry notional (200 % of margin at 20×) — the hard per-exposure
    /// bound on what the pool can pay out, and a 5× smaller I4 reserve per dollar of FX open interest than metals.
    uint16 internal constant FX_MAX_PROFIT_BPS = 1000;
    uint16 internal constant FX_TRADE_CAP_POOL_BPS = 1000;
    /// @dev Per-market OI caps per side = min(abs, pool × bps), sized by liquidity (EUR 15 %, GBP/JPY 10 %, CHF/CAD
    /// 7.5 %); skew caps equal the OI caps and a trade cap never exceeds its market's OI cap. The abs caps equal the
    /// pool-bps caps at the 250 AUSD seed, so the FX sum stays ≤ FX_EXPOSURE_SHARE_BPS of the pool whether the pool
    /// shrinks (bps binds) or grows to the TVL cap (abs binds: 125 / 1,000 = 12.5 %). No two FX markets may share
    /// identical MarketParams: an AccessManager op id is hash(caller, target, data), so two identical `addMarket`
    /// calls cannot both be scheduled (AddMarkets.s.sol, FxListing.assertExposureWithinShare).
    uint16 internal constant EUR_OI_CAP_POOL_BPS = 1500;
    uint128 internal constant EUR_OI_CAP_ABS_USD6 = 37.5e6;
    uint16 internal constant GBP_OI_CAP_POOL_BPS = 1000;
    uint128 internal constant GBP_OI_CAP_ABS_USD6 = 25e6;
    uint16 internal constant JPY_OI_CAP_POOL_BPS = 1000;
    uint128 internal constant JPY_OI_CAP_ABS_USD6 = 25e6;
    uint16 internal constant CHF_OI_CAP_POOL_BPS = 750;
    uint128 internal constant CHF_OI_CAP_ABS_USD6 = 18.75e6;
    uint16 internal constant CAD_OI_CAP_POOL_BPS = 750;
    uint128 internal constant CAD_OI_CAP_ABS_USD6 = 18.75e6;
    /// @dev Correlated-exposure bound (D-187): EUR, GBP, JPY, CHF and CAD all quote against the USD, so a USD move
    /// hits every FX book the same way. Σ per-side OI caps ≤ 50 % of the pool and of the LP seed; with the 10 % profit
    /// cap the pool's worst FX payout is 5 % of the seed. Asserted by FxListing.assertExposureWithinShare in every
    /// script that lists FX.
    uint16 internal constant FX_EXPOSURE_SHARE_BPS = 5000;

    // ---------------------------------------------------------------- gold (silver mirrors gold with its own feed)
    uint16 internal constant IM_BPS = 1000;
    uint16 internal constant MM_BPS = 500;
    uint16 internal constant FEE_BPS = 5;
    uint16 internal constant BASE_SPREAD_BPS = 5;
    uint16 internal constant DEV_SPREAD_BPS = 5;
    uint128 internal constant OI_CAP_ABS_USD6 = 150e6;
    uint16 internal constant OI_CAP_POOL_BPS = 6000;
    uint16 internal constant SKEW_CAP_POOL_BPS = 6000;
    uint16 internal constant TRADE_CAP_POOL_BPS = 2000;
    uint16 internal constant MAX_PROFIT_BPS = 5000;
    /// @dev ≈ 0.01 %/h at 100 % skew (RATE per second).
    uint64 internal constant FUNDING_FACTOR = 27_777_777_777;
    /// @dev ≈ 5 % APR base + 15 % APR at full utilisation (RATE per second).
    uint64 internal constant BORROW_BASE = 1_585_489_599;
    uint64 internal constant BORROW_SLOPE = 4_756_468_797;

    // ---------------------------------------------------------------- collateral (D-009)
    uint16 internal constant AUSD_HAIRCUT_BPS = 0;
    uint16 internal constant USDC_HAIRCUT_BPS = 50;
    uint128 internal constant DEPEG_FLOOR_18 = 0.98e18;

    // ---------------------------------------------------------------- seeds ([OK?] on mainnet)
    uint256 internal constant LP_SEED_USD6 = 250e6;
    uint256 internal constant INSURANCE_SEED_USD6 = 50e6;
    uint256 internal constant CARD_FLOAT_SEED_USD6 = 50e6;
    uint256 internal constant LP_TVL_CAP_USD6 = 1000e6;
    /// @dev Dead-address seed so the first depositor cannot inflate the share price.
    uint256 internal constant LP_DEAD_SEED_USD6 = 1e6;

    // ---------------------------------------------------------------- starter (D-030)
    uint256 internal constant MAINNET_DRIP_WEI = 0.3 ether;
    uint256 internal constant MAINNET_DAILY_BUDGET_WEI = 20 ether;
    uint256 internal constant TESTNET_DRIP_WEI = 0.05 ether;
    uint256 internal constant TESTNET_DAILY_BUDGET_WEI = 2 ether;
    uint256 internal constant TOPUP_CAP_WEI = 0.2 ether;
    uint256 internal constant PRACTICE_AMOUNT_USD6 = 100e6;
    uint256 internal constant VOUCHER_AMOUNT_USD6 = 12e6;
    uint256 internal constant MAX_VOUCHERS = 25;
    /// @dev Testnet: starter contract float and the mock float minted for LP/insurance/card seeds.
    uint256 internal constant TESTNET_STARTER_FUND_WEI = 0.5 ether;

    // ---------------------------------------------------------------- calendar maths (CME metals, DST union)
    uint256 internal constant SLOTS_PER_WEEK = 672;
    uint256 internal constant SLOTS_PER_DAY = 96;
    uint256 internal constant SLOTS_PER_HOUR = 4;
    uint256 internal constant BITS_PER_WORD = 256;
    uint256 internal constant FRIDAY = 4;
    uint256 internal constant SATURDAY = 5;
    uint256 internal constant SUNDAY = 6;
    /// @dev Daily break 17:00–18:00 ET = 21:00–22:00 UTC (EDT) ∪ 22:00–23:00 UTC (EST).
    uint256 internal constant DAILY_BREAK_START_HOUR = 21;
    uint256 internal constant DAILY_BREAK_END_HOUR = 23;
    /// @dev Weekend: Fri 17:00 ET (21:00 UTC EDT) → Sun 18:00 ET (23:00 UTC EST).
    uint256 internal constant FRIDAY_CLOSE_HOUR = 21;
    uint256 internal constant SUNDAY_OPEN_HOUR = 23;

    /// @notice CME metals weekly bitmap (bit = 1 open); slot 0 = Monday 00:00 UTC.
    function cmeMetalsWeek() internal pure returns (uint256[CALENDAR_WORD_COUNT] memory) {
        return _week(true);
    }

    /// @notice FX 24/5 bitmap. Chainlink Forex hours are 18:00 ET Sunday → 17:00 ET Friday with no daily break
    /// (docs.chain.link market hours); the DST union opens Sun 23:00 UTC (EST) and closes Fri 21:00 UTC (EDT).
    function fxWeek() internal pure returns (uint256[CALENDAR_WORD_COUNT] memory) {
        return _week(false);
    }

    function _week(bool dailyBreak) private pure returns (uint256[CALENDAR_WORD_COUNT] memory bits) {
        for (uint256 slot; slot < SLOTS_PER_WEEK; ++slot) {
            uint256 day = slot / SLOTS_PER_DAY;
            uint256 hour = (slot % SLOTS_PER_DAY) / SLOTS_PER_HOUR;
            bool closed = (dailyBreak && hour >= DAILY_BREAK_START_HOUR && hour < DAILY_BREAK_END_HOUR)
                || (day == FRIDAY && hour >= FRIDAY_CLOSE_HOUR) || day == SATURDAY
                || (day == SUNDAY && hour < SUNDAY_OPEN_HOUR);
            if (!closed) bits[slot / BITS_PER_WORD] |= uint256(1) << (slot % BITS_PER_WORD);
        }
    }

    /// @notice FX market params (D-187); `gapRisk` selects the 10× margins for JPY and CHF.
    function fxParams(bool gapRisk, uint16 oiCapPoolBps, uint128 oiCapAbsUsd6, uint16 tradeCapPoolBps)
        internal
        pure
        returns (MarketParams memory)
    {
        return MarketParams({
            imBps: gapRisk ? FX_GAP_IM_BPS : FX_IM_BPS,
            mmBps: gapRisk ? FX_GAP_MM_BPS : FX_MM_BPS,
            feeBps: FEE_BPS,
            baseSpreadBps: BASE_SPREAD_BPS,
            devSpreadBps: FX_DEV_SPREAD_BPS,
            oiCapPoolBps: oiCapPoolBps,
            skewCapPoolBps: oiCapPoolBps,
            tradeCapPoolBps: tradeCapPoolBps,
            maxProfitBps: FX_MAX_PROFIT_BPS,
            enabled: true,
            oiCapAbsUsd6: oiCapAbsUsd6,
            fundingFactor: FUNDING_FACTOR,
            borrowBase: BORROW_BASE,
            borrowSlope: BORROW_SLOPE
        });
    }

    function goldParams() internal pure returns (MarketParams memory) {
        return MarketParams({
            imBps: IM_BPS,
            mmBps: MM_BPS,
            feeBps: FEE_BPS,
            baseSpreadBps: BASE_SPREAD_BPS,
            devSpreadBps: DEV_SPREAD_BPS,
            oiCapPoolBps: OI_CAP_POOL_BPS,
            skewCapPoolBps: SKEW_CAP_POOL_BPS,
            tradeCapPoolBps: TRADE_CAP_POOL_BPS,
            maxProfitBps: MAX_PROFIT_BPS,
            enabled: true,
            oiCapAbsUsd6: OI_CAP_ABS_USD6,
            fundingFactor: FUNDING_FACTOR,
            borrowBase: BORROW_BASE,
            borrowSlope: BORROW_SLOPE
        });
    }

    /// @notice The AUSD/USDC v4 pool the CollateralSwapper routes through (mainnet).
    function stablePoolKey() internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: MAINNET_AUSD,
            currency1: MAINNET_USDC,
            fee: STABLE_POOL_FEE,
            tickSpacing: STABLE_POOL_TICK_SPACING,
            hooks: address(0)
        });
    }

    function collateral(address usdFeed, uint16 haircutBps) internal pure returns (CollateralCfg memory) {
        return CollateralCfg({
            enabled: true,
            haircutBps: haircutBps,
            feedHeartbeat: STABLE_HEARTBEAT,
            usdFeed: usdFeed,
            depegFloor18: DEPEG_FLOOR_18
        });
    }
}
