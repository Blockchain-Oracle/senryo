// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @dev File-level so it can size fixed arrays (672 calendar slots / 256 bits per word).
uint256 constant CALENDAR_WORD_COUNT = 3;

/// @title Constants — every protocol-wide number lives here (invariant `sol-no-magic-numbers`).
/// @notice Per-market parameters are seeded from `script/SeedConstants.sol` and stored onchain.
/// Units: usd6 (1e6 = $1) · PRICE 1e18 USD per unit · SIZE 1e18 units · BPS 1e4 · RATE 1e18 per second.
library Constants {
    // ---------------------------------------------------------------- units
    uint256 internal constant USD6 = 1e6;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    /// @dev size (1e18) × price (1e18) / NOTIONAL_SCALE = usd6.
    uint256 internal constant NOTIONAL_SCALE = 1e30;
    uint8 internal constant PRICE_DECIMALS = 18;
    uint256 internal constant DECIMAL_BASE = 10;
    uint256 internal constant SECONDS_PER_HOUR = 3600;
    uint256 internal constant SECONDS_PER_DAY = 86_400;
    uint256 internal constant SECONDS_PER_WEEK = 604_800;

    // ---------------------------------------------------------------- chains
    uint256 internal constant MAINNET_CHAIN_ID = 143;
    uint256 internal constant TESTNET_CHAIN_ID = 10_143;

    // ---------------------------------------------------------------- access roles (OZ AccessManager; ADMIN_ROLE = 0)
    uint64 internal constant PARAM_ADMIN_ROLE = 10;
    uint64 internal constant GUARDIAN_ROLE = 20;
    uint64 internal constant CARD_OPERATOR_ROLE = 30;
    uint64 internal constant POOL_ROLE = 40;
    uint64 internal constant ROUTER_ROLE = 50;
    uint64 internal constant RELAYER_ROLE = 60;
    uint64 internal constant MIRROR_ROLE = 70;
    uint64 internal constant MINTER_ROLE = 80;
    /// @dev PARAM_ADMIN execution delay: 6 h during the hackathon, 48 h after (D-entry when raised).
    uint32 internal constant PARAM_DELAY = 6 hours;
    /// @dev Guardian pauses/halts auto-expire.
    uint64 internal constant MAX_PAUSE_SECONDS = 72 hours;

    // ---------------------------------------------------------------- markets
    /// @dev `Account.positionBitmap` is a uint32.
    uint256 internal constant MAX_MARKETS = 32;
    uint256 internal constant MIN_POSITION_NOTIONAL_USD6 = 5e6;
    /// @dev Anti-flash: a profitable reduce waits this many blocks after the last increase (~300 ms blocks).
    uint64 internal constant MIN_HOLD_BLOCKS = 20;
    uint256 internal constant CLOSED_IM_MULTIPLIER = 2;
    uint256 internal constant MAX_RESERVE_UTIL_BPS = 8000;
    uint256 internal constant FEE_TO_INSURANCE_BPS = 1000;

    // ---------------------------------------------------------------- spreads (risk-math.md "Execution price")
    uint256 internal constant AGE_SPREAD_BPS_PER_HOUR = 6;
    uint256 internal constant AGE_SPREAD_CAP_BPS = 10;
    uint256 internal constant CLOSED_BASE_SPREAD_BPS = 25;
    uint256 internal constant CLOSED_SPREAD_BPS_PER_HOUR = 5;
    uint256 internal constant CLOSED_SPREAD_CAP_BPS = 300;
    /// @dev impactBps = IMPACT_K_BPS × (|skewAfter| − |skewBefore|) / (pool × DEPTH_POOL_BPS / BPS).
    uint256 internal constant IMPACT_K_BPS = 10;
    uint256 internal constant DEPTH_POOL_BPS = 10_000;
    uint256 internal constant MAX_IMPACT_BPS = 50;

    // ---------------------------------------------------------------- funding / borrow (RATE = 1e18 per second)
    /// @dev ≈ 0.1 % per hour.
    uint256 internal constant MAX_FUNDING_RATE = 277_777_777_777;
    uint256 internal constant MIN_OI_USD6 = 100e6;

    // ---------------------------------------------------------------- account
    uint256 internal constant SAFETY_BUFFER_USD6 = 1e6;

    // ---------------------------------------------------------------- liquidation
    uint256 internal constant LIQ_PENALTY_BPS = 100;
    uint256 internal constant LIQ_FEE_SHARE_BPS = 5000;
    uint256 internal constant LIQ_FEE_CAP_USD6 = 5e6;

    // ---------------------------------------------------------------- card (D-032, D-036)
    uint256 internal constant MAX_HOLD_USD6 = 250e6;
    uint64 internal constant HOLD_TTL = 7 days;
    uint64 internal constant HOLD_RELEASE_GRACE = 1 days;
    uint256 internal constant CAPTURE_OVER_TOLERANCE_BPS = 2000;

    // ---------------------------------------------------------------- oracle (SessionOracle)
    uint64 internal constant FEED_GRACE = 600;
    uint256 internal constant CONFIRM_ROUNDS = 3;
    uint64 internal constant CONFIRM_SECONDS = 300;
    /// @dev Confirmation walks back at most this many consecutive in-band rounds.
    uint256 internal constant CONFIRM_LOOKBACK_ROUNDS = 8;
    uint256 internal constant CONFIRM_BAND_BPS = 50;
    uint64 internal constant REOPEN_WINDOW = 300;

    // ---------------------------------------------------------------- calendar (MarketCalendar)
    /// @dev Monday 1970-01-05 00:00 UTC; slot 0 of every week.
    uint256 internal constant WEEK_ANCHOR = 345_600;
    uint256 internal constant SLOT_SECONDS = 900;
    uint256 internal constant SLOTS_PER_WEEK = 672;
    uint256 internal constant SLOTS_PER_WORD = 256;
    uint256 internal constant CALENDAR_WORDS = CALENDAR_WORD_COUNT;
    uint256 internal constant MAX_HOLIDAYS = 32;

    // ---------------------------------------------------------------- LP vault
    uint64 internal constant LP_REDEEM_DELAY = 1 days;
    uint8 internal constant LP_VIRTUAL_SHARE_OFFSET = 6;
    address internal constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
}
