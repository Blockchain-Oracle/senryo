// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Senryo markets (D-256…D-267): windows and prints ported from CWF d7b576b:contracts/src/engine/{EngineTypes,libs/
// AdminLib,libs/ResolveLib}.sol without the order book; the reserve from CWF d7b576b:contracts/src/products/range/
// {RangeReserve,RangePricing,RangeMath}.sol and products/shared/Payouts.sol. Every number lives here
// (invariant `sol-no-magic-numbers`).

// ---------------------------------------------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------------------------------------------

/// @dev Probabilities and prices of a $1 payout, × 1e6.
uint256 constant P_ONE = 1_000_000;
uint256 constant BPS = 10_000;
/// @dev Every recorded print is `priceE8 × 10⁻⁸` (D-259).
int8 constant PRINT_EXPO = -8;
int8 constant MIN_SOURCE_EXPO = -18;
uint256 constant DECIMAL_BASE = 10;
/// @dev Baskets (D-286, D-124): a basket starts at 1,000 points (× 1e8) at its frozen base prices; 2–8 members.
uint256 constant BASKET_BASE_POINTS_E8 = 100_000_000_000;
uint256 constant BASKET_MIN_MEMBERS = 2;
uint256 constant BASKET_MAX_MEMBERS = 8;

// ---------------------------------------------------------------------------------------------------------------
// Windows (D-261, D-265)
// ---------------------------------------------------------------------------------------------------------------

/// @dev Cadences divide one hour (a boundary is `ts % cadence == 0`): 1m, 5m, 15m, 1h.
uint32 constant MIN_CADENCE_SEC = 60;
uint32 constant CADENCE_DIVIDES_SEC = 3600;
/// @dev A window may be opened at most this far ahead of its start.
uint40 constant MAX_LEAD_SEC = 86_400;
/// @dev Calendar slots (MarketCalendar): a window must be open in every slot it spans.
uint40 constant CALENDAR_SLOT_SEC = 900;
uint8 constant MAX_POLICY_VERSIONS = 8;
uint40 constant OPEN_ENDED = type(uint40).max;

uint8 constant STATE_OPEN = 0;
uint8 constant STATE_RESOLVED = 1;
uint8 constant STATE_VOIDED = 2;

uint8 constant VOID_NONE = 0;
uint8 constant VOID_MISSING_PRINT = 1;
uint8 constant VOID_CROSS_CHECK_DIVERGENCE = 2;

// ---------------------------------------------------------------------------------------------------------------
// Calls (D-261, D-263)
// ---------------------------------------------------------------------------------------------------------------

/// @dev Opens and closes stop this long before expiry.
uint40 constant LOCKOUT_SEC = 20;
/// @dev A commit fills at the unique print of `commit + FILL_DELAY_SEC` (or the first one after it, within grace).
uint40 constant FILL_DELAY_SEC = 1;
/// @dev A close needs the position held this long and a newer print.
uint40 constant MIN_HOLD_SEC = 3;
/// @dev The last seconds before the close print never divide the volatility scale to zero (CWF FairValue).
uint256 constant MIN_SECONDS_LEFT = 5;
uint8 constant MAX_BANDS = 8;
uint256 constant MAX_BATCH = 32;

uint8 constant BAND_UP = 1; // (K, ∞); refund at exactly K
uint8 constant BAND_DOWN = 2; // (0, K); refund at exactly K
uint8 constant BAND_RANGE = 3; // [K − a, K + b], inclusive
uint8 constant BAND_MOONSHOT = 4; // (K + x, ∞), strike excluded
uint8 constant BAND_CRASH = 5; // (0, K − x), strike excluded

uint8 constant OUTCOME_LOSE = 0;
uint8 constant OUTCOME_WIN = 1;
uint8 constant OUTCOME_REFUND = 2;
uint8 constant OUTCOME_COUNT = 3;

uint8 constant TICKET_NONE = 0;
uint8 constant TICKET_COMMITTED = 1; // stake escrowed, waiting for its fill print
uint8 constant TICKET_OPEN = 2; // filled
uint8 constant TICKET_CLOSED = 3; // fully cashed out
uint8 constant TICKET_SETTLED = 4; // paid, refunded or lost after the window settled
uint8 constant TICKET_REFUNDED = 5; // never filled: refused, voided or its window settled first

uint8 constant ACTION_OPEN = 1;
uint8 constant ACTION_CLOSE = 2;

uint8 constant REFUSE_PRICE = 1; // probability outside the band, or no edge left for the pool
uint8 constant REFUSE_SLIPPAGE = 2; // below the signed limit
uint8 constant REFUSE_CAPACITY = 3; // pool liquidity, exposure or per-expiry cap
uint8 constant REFUSE_CONFIG = 4; // pricing config changed since the commit
uint8 constant REFUSE_WINDOW = 5; // the window settled first
uint8 constant REFUSE_NO_PRINT = 6; // no print inside the fill window
uint8 constant REFUSE_EXIT = 7; // the fill print's bid missed the exit's prices (the exit stands)

/// @dev Parlays (D-293): 2–4 legs, one per market; legs in one asset class (one trading calendar) are priced as
///      correlated — their joint chance is at least `PARLAY_CORRELATION_BPS` of the least likely of them.
uint256 constant MIN_PARLAY_LEGS = 2;
uint256 constant MAX_PARLAY_LEGS = 4;
uint256 constant PARLAY_CORRELATION_BPS = 8500;

uint8 constant LEG_PENDING = 0;
uint8 constant LEG_WON = 1;
uint8 constant LEG_TIED = 2; // dropped: the parlay pays on the other legs
uint8 constant LEG_LOST = 3;
uint8 constant LEG_VOID = 4; // the whole parlay is refunded

/// @dev What a pending close was fired for (D-292).
uint8 constant EXIT_NONE = 0;
uint8 constant EXIT_PRICE = 1; // take-profit or stop-loss: their prices decide at the fill print, so anyone may fire
uint8 constant EXIT_TRAIL = 2; // the trail: the exit keeper's ratcheting stop decides when, above the owner's floor

// ---------------------------------------------------------------------------------------------------------------
// Bounds the admin can never exceed (D-262, D-264)
// ---------------------------------------------------------------------------------------------------------------

uint32 constant MAX_HALF_SPREAD_E6 = 50_000;
uint32 constant MAX_SURCHARGE_E6 = 50_000;
uint32 constant MIN_PROB_FLOOR_E6 = 10_000;
uint32 constant MAX_PROB_CEIL_E6 = 990_000;
uint16 constant MAX_EXPOSURE_BPS = 8000;
uint64 constant MAX_SIGMA_E8 = 1_000_000;

// ---------------------------------------------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------------------------------------------

/// @dev Who proves a print: an immutable verifier (its own grace, quality bound and admission window) and a feed.
struct PrintSource {
    address verifier;
    bytes32 feedId;
}

/// @dev One dated, immutable policy version of a series (CWF PD-1). `check.verifier == 0` means no cross-check.
struct PolicyVersion {
    uint40 validFrom; // inclusive
    uint40 validUntil; // inclusive
    uint16 maxDivergenceBps;
    PrintSource primary;
    PrintSource check;
}

struct Series {
    bytes32 market; // ASCII symbol, left-aligned ("BTC")
    uint32 cadenceSec;
    uint8 calendarId; // 0 = always open (crypto)
    uint8 versionCount;
}

/// @dev A recorded print, normalised to e-8. `publishTime == 0` means none.
struct Print {
    int64 priceE8;
    uint64 confE8;
    uint40 publishTime;
}

struct Window {
    bytes32 seriesId;
    uint40 start; // open boundary
    uint40 expiry; // close boundary
    uint8 policyVersion;
    uint8 state;
    uint8 voidReason;
    int64 openE8;
    int64 closeE8;
    uint40 resolvedAt;
}

/// @dev A fixed band around the window's open print K (D-263). Offsets are basis points of K:
///      RANGE uses `lowBps` below and `highBps` above; MOONSHOT and CRASH use `lowBps` as the strike distance.
struct BandDef {
    uint8 kind;
    uint16 lowBps;
    uint16 highBps;
}

/// @dev Pool pricing and risk terms (D-262, D-264); every change bumps `configVersion`.
struct Params {
    uint32 halfSpreadE6;
    uint32 maxSurchargeE6;
    uint32 minProbE6;
    uint32 maxProbE6;
    uint16 maxExposureBps;
    uint64 maxExpiryReserved;
    uint64 minStake;
    uint64 maxStake;
}

/// @dev One call. Money is in collateral base units; `payout` is the remaining $1-shares (each pays one unit).
struct Ticket {
    address owner;
    uint8 status;
    uint8 band;
    uint40 target; // the fill-print instant of the pending open or close
    uint40 filledAt;
    bytes32 windowId;
    address recipient;
    uint32 configVersion;
    uint64 stake; // remaining basis (refunded on a tie or void)
    uint64 payout; // remaining shares
    uint64 limit; // pending action's minimum (payout for an open, proceeds for a close)
    uint64 closing; // shares a pending close sells (0 = no close pending)
    int64 entryE8; // fill print
    uint32 entryProbE6; // price paid per share (probability + spread + surcharge)
}

/// @dev A signed call (D-266). OPEN: `amount` is the stake, `limit` the minimum payout. CLOSE: `amount` is the shares
///      to sell, `limit` the minimum proceeds. Payouts and proceeds go to `recipient` (the owner for a session).
struct Intent {
    uint8 action;
    address owner;
    bytes32 windowId;
    uint8 band;
    uint256 ticketId;
    uint64 amount;
    uint64 limit;
    address recipient;
    uint32 configVersion;
    uint64 deadline;
    uint256 nonce;
    uint32 epoch;
}

/// @dev A ticket's standing exit (D-292): a share's bid × 1e6, 0 = unset. Take-profit fills at a bid ≥ `takeProfitE6`;
///      stop-loss at `floorE6 ≤ bid ≤ stopLossE6`; the trail (the keeper's stop, `trailE6` below the best bid seen) at a
///      bid ≥ `floorE6`. Per share, so a partial cash-out leaves it right; `epoch` is the owner's when it was set.
struct Exit {
    uint32 takeProfitE6;
    uint32 stopLossE6;
    uint32 floorE6;
    uint32 trailE6;
    uint32 epoch;
    uint8 firing;
}

/// @dev Sets (all prices 0: clears) a ticket's exit, signed by the owner or their live session delegate.
struct ExitOrder {
    address owner;
    uint256 ticketId;
    uint32 takeProfitE6;
    uint32 stopLossE6;
    uint32 floorE6;
    uint32 trailE6;
    uint64 deadline;
    uint256 nonce;
    uint32 epoch;
}

/// @dev A signed parlay (D-293): legs in close order (expiry non-decreasing), `minPayout` the least it accepts.
struct ParlayIntent {
    address owner;
    bytes32[] windowIds;
    uint8[] bands;
    uint64 stake;
    uint64 minPayout;
    address recipient;
    uint32 configVersion;
    uint64 deadline;
    uint256 nonce;
    uint32 epoch;
}

/// @dev One parlay. `addOnE6` is what the fill priced on top of the legs' joint chance (the spread and surcharge),
///      kept so a tied leg can drop out at the same terms.
struct Parlay {
    address owner;
    uint8 status;
    uint8 legCount;
    uint40 target;
    address recipient;
    uint32 configVersion;
    uint32 addOnE6;
    uint64 stake;
    uint64 payout;
    uint64 limit;
}

struct ParlayLeg {
    bytes32 windowId;
    uint40 expiry;
    uint8 band;
    uint8 group; // the series' calendar: legs sharing one are priced as correlated
    uint8 outcome;
    uint32 probE6; // the band's probability at the fill print
}

/// @dev The owner's one-Face-ID grant to an ephemeral delegate key (D-267).
struct SessionGrant {
    address owner;
    address delegate;
    uint64 perCallCap;
    uint64 sessionCap;
    uint40 expiry;
    uint32 epoch;
    uint256 nonce;
}

struct Session {
    address delegate;
    uint40 expiry;
    uint32 epoch;
    uint64 perCallCap;
    uint64 sessionCap;
    uint64 spent;
}

/// @dev An EIP-2612 permit the relayer submits with a commit or a grant (`deadline == 0` = none).
struct Permit {
    uint256 value;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

/// @dev Per window and band: the remaining shares and stake basis of every filled ticket (settled in one pass).
struct BandTotals {
    uint128 payout;
    uint128 stake;
}
