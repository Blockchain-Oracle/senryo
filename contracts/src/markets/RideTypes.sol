// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Rides — "ride the price" (D-299, D-301): an isolated long (UP) or short (DOWN) with leverage, against the shared pool,
// filled at the next unique print, its whole possible profit reserved at the fill. Study `07-ride-the-price.md` §2;
// the removed linear engine (`git show cd37e193^:contracts/src/libraries/PerpMath.sol`) for rounding against the
// account. Every number lives here (invariant `sol-no-magic-numbers`).

// ---------------------------------------------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------------------------------------------

/// @dev A ride's size is notional × `RIDE_SCALE` / entry price (× 1e8), so PnL in collateral units is
///      size × Δprice(× 1e8) / `RIDE_SCALE`.
uint256 constant RIDE_SCALE = 1e20;

// ---------------------------------------------------------------------------------------------------------------
// Bounds the admin can never exceed (D-301; each network sets its terms inside them, `pool-terms.ts`)
// ---------------------------------------------------------------------------------------------------------------

uint32 constant MIN_LEVERAGE_BPS = 10_000; // 1×
uint32 constant MAX_LEVERAGE_BPS = 500_000; // 50×
/// @dev The reserve (the most a ride can win) is margin × min(maxProfitBps, leverage × maxMoveBps).
uint32 constant MAX_PROFIT_BPS = 90_000; // 900 %
uint16 constant MAX_MOVE_BPS = 5000; // 50 %
/// @dev Knocked out once 90 % of the margin is lost (gTrade's legacy line); the prover takes 2 % of it, at most $5.
uint16 constant KO_LOSS_BPS = 9000;
uint16 constant KO_KEEPER_BPS = 200;
uint64 constant KO_KEEPER_CAP = 5_000_000;
uint16 constant MAX_RIDE_FEE_BPS = 20;
/// @dev The early-close fee on a profitable close: up to `earlyFeeBps` of the exit notional, falling to 0 over
///      `earlyWindowSec`, never more than the profit.
uint16 constant MAX_EARLY_FEE_BPS = 50;
uint32 constant MAX_EARLY_WINDOW_SEC = 60;
/// @dev A ride lives at most this long, then settles at the print of its end (D-299: 4 h).
uint32 constant MAX_RIDE_LIFE_SEC = 14_400;
/// @dev Bounds the frontier refresh (`refreshFrontier` takes a side's whole id list in one transaction).
uint32 constant MAX_OPEN_PER_SIDE = 400;
uint16 constant MAX_LINEAR_BPS = 5000;
uint16 constant MAX_HOURLY_LOSS_BPS = 2000;
uint16 constant MAX_SKEW_CAP_BPS = 10_000;
uint16 constant MAX_MARKET_RESERVE_BPS = 5000;
/// @dev Earn's roll marks rides at a print at most this old (D-307).
uint40 constant RIDE_MARK_MAX_AGE_SEC = 5;
uint40 constant RIDE_HOUR_SEC = 3600;
uint256 constant MAX_RIDE_BATCH = 32;

// ---------------------------------------------------------------------------------------------------------------
// States and outcomes
// ---------------------------------------------------------------------------------------------------------------

uint8 constant RIDE_NONE = 0;
uint8 constant RIDE_COMMITTED = 1; // margin and fee escrowed, waiting for the fill print
uint8 constant RIDE_OPEN = 2;
uint8 constant RIDE_CLOSED = 3; // closed by the owner, a TP/SL or the trail
uint8 constant RIDE_KNOCKED_OUT = 4; // a recorded print crossed its KO
uint8 constant RIDE_CAPPED = 5; // a recorded print crossed its cap: paid its whole reserve
uint8 constant RIDE_ENDED = 6; // settled at the print of its end of life
uint8 constant RIDE_REFUNDED = 7; // never filled

uint8 constant SIDE_LONG = 0;
uint8 constant SIDE_SHORT = 1;
uint8 constant SIDES = 2;

// ---------------------------------------------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------------------------------------------

/// @dev One ride market's terms (set by PARAMS inside the bounds above). v1 lists the 24/7 Pyth crypto only (D-299).
struct RideMarket {
    address verifier;
    bool enabled;
    uint32 maxLeverageBps;
    uint16 takerFeeBps;
    uint16 makerFeeBps; // when the trade reduces the pool's skew in the market
    bytes32 feedId;
    uint32 maxProfitBps;
    uint16 maxMoveBps;
    uint16 marketReserveBps; // of the pool
    uint16 skewCapBps; // of the pool, on |long − short| entry notional
    uint32 maxLifeSec;
    uint64 marketReserveCap;
    uint64 minMargin;
    uint64 maxMargin;
}

/// @dev The terms every ride shares (PARAMS).
struct RideTerms {
    uint16 maxLinearBps; // rides' reserve as a share of the pool
    uint16 maxHourlyLossBps; // realised ride loss in an hour, as a share of the pool, before opens stop
    uint16 earlyFeeBps;
    uint32 earlyWindowSec;
}

/// @dev One ride, five slots (MIP-8: about 25 to a page). `closing` is the size a pending close sells; `limitE8` the
///      worst price the pending open or close accepts. KO and cap are fixed at the fill, so the Liq tag never drifts.
struct Ride {
    address owner;
    uint8 status;
    bool isLong;
    uint16 marketId;
    uint40 target;
    address recipient;
    uint40 filledAt;
    uint40 updatedAt;
    uint32 configVersion;
    uint32 leverageBps;
    uint64 margin;
    uint64 reserve;
    uint64 openFee;
    uint128 size;
    uint128 closing;
    int64 entryE8;
    int64 koE8;
    int64 capE8;
    int64 limitE8;
}

/// @dev One market side's sums over its open rides, moved only by the rides' stored values (the D-182 lesson), and
///      the bound frontier: the most extreme KO and cap any open ride on the side has had since the side last emptied
///      (long: highest KO, lowest cap; short: lowest KO, highest cap). Never narrowed by an exit, so a check against it
///      is conservative; `refreshFrontier` tightens it from the side's full id list.
struct RideSide {
    uint128 size;
    uint128 margin;
    uint256 cost; // Σ size × entry
    uint128 reserve;
    uint32 count;
    int64 koEdgeE8;
    int64 capEdgeE8;
}

/// @dev A signed ride action (EIP-712). OPEN: `margin` at `leverageBps` on `marketId`, `isLong`; CLOSE: `size` of
///      `rideId` (0 = all). Either fills at the next print, refused beyond `worstPriceE8`.
struct RideIntent {
    uint8 action;
    address owner;
    uint16 marketId;
    bool isLong;
    uint256 rideId;
    uint64 margin;
    uint32 leverageBps;
    uint128 size;
    int64 worstPriceE8;
    address recipient;
    uint32 configVersion;
    uint64 deadline;
    uint256 nonce;
    uint32 epoch;
}
