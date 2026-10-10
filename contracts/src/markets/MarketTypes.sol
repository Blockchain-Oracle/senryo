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
/// @dev A commit fills at the unique print of `commit + params.fillDelaySec` (D-300: a setting, 1–3 s).
uint8 constant MIN_FILL_DELAY_SEC = 1;
uint8 constant MAX_FILL_DELAY_SEC = 3;
/// @dev σ marks (D-300): a fill carries the keeper's mark of the last minute boundary at least this long before it.
uint40 constant SIGMA_MARK_LAG_SEC = 5;
uint40 constant SIGMA_MARK_STEP_SEC = 60;
/// @dev A close needs the position held this long and a newer print.
uint40 constant MIN_HOLD_SEC = 3;
/// @dev The last seconds before the close print never divide the volatility scale to zero (CWF FairValue).
uint256 constant MIN_SECONDS_LEFT = 5;
uint8 constant MAX_BANDS = 8;
uint256 constant MAX_BATCH = 32;

/// @dev The shape table's data contract (D-300, `TailTableData`; SSTORE2): a 22-byte header — format, horizon count,
///      points per row (u16), z step × 1e4 (u16), the σ model's mark weight and fade per second (u64 × 1e18 each) —
///      then the horizons (u16 seconds, ascending), then every row's F_τ(z) × 1e6 (three bytes an entry).
uint8 constant TAIL_FORMAT = 1;
uint256 constant TAIL_HEADER_BYTES = 22;
uint256 constant TAIL_POINTS_AT = 2;
uint256 constant TAIL_Z_STEP_AT = 4;
uint256 constant TAIL_WEIGHT_AT = 6;
uint256 constant TAIL_FADE_AT = 14;
uint256 constant TAIL_U16_BYTES = 2;
uint256 constant TAIL_U64_BYTES = 8;
uint256 constant TAIL_ENTRY_BYTES = 3;
uint256 constant TAIL_MIN_COUNT = 2;
uint256 constant TAIL_MAX_TAUS = 16;
uint256 constant TAIL_MAX_POINTS = 401;
uint256 constant TAIL_MAX_WEIGHT_WAD = 1e18;
uint256 constant TAIL_MAX_FADE_WAD = 1e15;

/// @dev A menu packs each band into 40 bits — kind · lowBps · highBps — six to a slot, so a series' whole book sits in
///      one MIP-8 storage page and a five-band listing writes two slots (D-309).
uint256 constant BAND_KIND_SHIFT = 32;
uint256 constant BAND_LOW_SHIFT = 16;
uint256 constant BAND_FIELD_MASK = 0xffff;
uint256 constant BAND_KIND_MASK = 0xff;

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
/// @dev The spread curve h(p) = max(minHalfSpread, 4·h50·p(1−p)) (D-300): 4 / 1e6² in probability units.
uint256 constant SPREAD_CURVE_FACTOR = 4;
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

/// @dev How one series is priced (D-300): the bounds its σ marks are held to, and its half-spread at p = ½ (`h50`).
struct SeriesTerms {
    uint64 sigmaFloorE8;
    uint64 sigmaCapE8;
    uint32 h50E6;
}

/// @dev A series' listing in the reserve, laid out for MIP-8: the terms and the band count share slot 0, the packed
///      menu (`BandMath.pack`) takes the next two. `bandCount == 0` means not listed.
struct SeriesBook {
    uint64 sigmaFloorE8;
    uint64 sigmaCapE8;
    uint32 h50E6;
    uint8 bandCount;
    uint40[MAX_BANDS] bands;
}

/// @dev The keeper's σ for one feed through one minute boundary (D-300), σ per √second × 1e8: `fastE8` the winsorised
///      EWMA of 1-minute returns, `slowE8` the one-day anchor. Signed (EIP-712) by an allowed σ signer; a fill carries
///      the mark of `SigmaMarks.markMinuteOf(target)` and nothing else.
struct SigmaMark {
    bytes32 feedId;
    uint40 minute;
    uint64 fastE8;
    uint64 slowE8;
}

/// @dev Pool pricing and risk terms (D-262, D-264, D-300); every change bumps `configVersion`. `minHalfSpreadE6` is the
///      spread curve's floor (h50 is per series); `fillDelaySec` the seconds from a commit to its fill print.
struct Params {
    uint32 minHalfSpreadE6;
    uint32 maxSurchargeE6;
    uint32 minProbE6;
    uint32 maxProbE6;
    uint16 maxExposureBps;
    uint64 maxExpiryReserved;
    uint64 minStake;
    uint64 maxStake;
    uint8 fillDelaySec;
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

/// @dev The books a standing exit can belong to (D-292 made generic, R3.12): a call's levels are a share's bid × 1e6,
///      a ride's are prices × 1e8 (its trail a distance in bps). An exit's key is `book << EXIT_BOOK_SHIFT | id`.
uint8 constant BOOK_CALL = 1;
uint8 constant BOOK_RIDE = 2;
uint256 constant EXIT_BOOK_SHIFT = 248;

/// @dev A position's standing exit, 0 = unset. A call: take-profit fills at a bid ≥ `takeProfit`, stop-loss at
///      `floor ≤ bid ≤ stopLoss`, the trail (the keeper's stop, `trail` below the best bid seen) at a bid ≥ `floor`.
///      A ride: take-profit at a print past `takeProfit`, stop-loss at a print past `stopLoss` (a stop-market, bounded
///      by the knock-out), the trail (the keeper's, `trail` bps behind the best print) at a print on the right side of
///      `floor`. Per share or per unit of size, so a partial exit leaves it right; `epoch` is the owner's when set.
struct Exit {
    uint64 takeProfit;
    uint64 stopLoss;
    uint64 floor;
    uint64 trail;
    uint32 epoch;
    uint8 firing;
}

/// @dev Sets (every level 0: clears) a position's exit, signed by the owner or their live session delegate.
struct ExitOrder {
    address owner;
    uint8 book;
    uint256 id;
    uint64 takeProfit;
    uint64 stopLoss;
    uint64 floor;
    uint64 trail;
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
