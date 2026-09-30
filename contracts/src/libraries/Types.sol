// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @notice Market session status (risk-math.md status matrix). Only OPEN allows new risk or liquidation.
enum MarketStatus {
    OPEN,
    REOPENING,
    CLOSED,
    STALE,
    CIRCUIT,
    HALTED
}

enum DepositSource {
    DIRECT,
    AURORA,
    INBOX,
    VOUCHER
}

enum PositionKind {
    OPEN,
    INCREASE,
    DECREASE,
    CLOSE,
    LIQUIDATE,
    TRIGGER
}

enum HoldState {
    NONE,
    OPEN,
    CAPTURED,
    RELEASED
}

enum ReleaseReason {
    OPERATOR,
    EXPIRED,
    RELEASE_ONLY,
    CAPTURE_REMAINDER
}

/// @notice Internal ledger accounts (entries, not ERC-20 transfers).
enum Book {
    POOL,
    INSURANCE,
    CARD_FLOAT
}

/// @notice One user's whole state in three storage slots (one MIP-8 page).
struct Account {
    uint128 usdc;
    uint128 ausd;
    uint128 holds;
    uint128 cardDebt;
    uint128 envelope;
    uint64 nonce;
    uint32 positionBitmap;
}

/// @notice One net position per (user, market).
struct Position {
    uint128 size;
    uint128 entry;
    int128 fundingSnap;
    uint128 borrowSnap;
    uint64 openedBlock;
    bool isLong;
}

/// @notice Per-token balances of an internal book.
struct BookBalance {
    uint128 ausd;
    uint128 usdc;
}

/// @notice Risk parameters of one market (feed, calendar and clamps live in SessionOracle).
struct MarketParams {
    uint16 imBps;
    uint16 mmBps;
    uint16 feeBps;
    uint16 baseSpreadBps;
    uint16 devSpreadBps;
    uint16 oiCapPoolBps;
    uint16 skewCapPoolBps;
    uint16 tradeCapPoolBps;
    uint16 maxProfitBps;
    bool enabled;
    uint128 oiCapAbsUsd6;
    uint64 fundingFactor;
    uint64 borrowBase;
    uint64 borrowSlope;
}

/// @notice O(1) aggregates of one market (Σ over open positions).
struct MarketState {
    uint128 longSize;
    uint128 shortSize;
    /// @dev Σ size × entry / 1e18 (usd18).
    uint256 longEntry18;
    uint256 shortEntry18;
    /// @dev Σ N_entry per side (usd6), the base of funding, borrow and the profit reserve.
    uint128 longNotional;
    uint128 shortNotional;
    int256 fundingIndex;
    uint256 borrowIndex;
    /// @dev Σ N_entry × snapshot, per side for funding and combined for borrow.
    int256 longFundingSnapSum;
    int256 shortFundingSnapSum;
    uint256 borrowSnapSum;
    uint64 lastAccrual;
}

struct CollateralCfg {
    bool enabled;
    uint16 haircutBps;
    uint32 feedHeartbeat;
    address usdFeed;
    uint128 depegFloor18;
}

/// @notice What SessionOracle reports for one market.
struct PriceView {
    /// @dev last accepted price (1e18 USD per unit); 0 when nothing was ever accepted.
    uint256 price18;
    /// @dev the feed's latest answer normalised to 1e18 (0 when invalid).
    uint256 latest18;
    uint64 updatedAt;
    MarketStatus status;
    /// @dev oracle spread component: age spread, or the closed-session spread when CLOSED.
    uint16 spreadBps;
}

struct Hold {
    address user;
    uint64 expiry;
    bool fromEnvelope;
    HoldState state;
    uint128 amount;
    bytes32 issuer;
}

/// @notice User-signed card spend allowance (D-032).
struct Allowance {
    uint128 dailyLimit;
    uint128 usedToday;
    uint64 expiry;
    uint64 day;
}

/// @notice User-signed TP/SL order (EIP-712).
struct TriggerOrder {
    address user;
    uint8 marketId;
    bool isLong;
    bool takeProfit;
    uint128 triggerPrice18;
    uint128 sizeDelta;
    uint128 acceptablePrice18;
    uint64 expiry;
    uint64 salt;
}

/// @notice Account risk snapshot (risk-math.md "Account").
struct Risk {
    int256 equityInit;
    int256 equityLiq;
    uint256 im;
    uint256 mm;
    int256 freeToTrade;
    int256 freeToSpend;
    bool allOpen;
    bool anyUnsafe;
}
