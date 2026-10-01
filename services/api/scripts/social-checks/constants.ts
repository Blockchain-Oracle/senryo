/**
 * Fixture values for the social check suites (usd6 money). Kept as named data so each check states its expectation
 * in terms of these, never as bare literals.
 */

const USD = 1_000_000n;

/** Rolling 24h fills: three per trader at $100 each (the 24h floor is 3 trades / $100). */
export const LB_FILL = {
  count: 3,
  notional: 100n * USD,
  alice: { pnl: 10n * USD, fee: 1n * USD },
  bob: { pnl: 20n * USD, fee: 0n },
  /** Carol trades big but too rarely: below the floor. */
  carol: { pnl: 500n * USD, count: 2 },
  /** Dave is the best trader of all — and unlisted on practice. */
  dave: { pnl: 1_000n * USD },
} as const;

/** UTC-day buckets: days back from today. */
export const LB_DAYS = {
  /** Alice today: enough for 7d (5 trades, $600 ≥ $500) but not alone for 30d. */
  aliceToday: { back: 0, trades: 5, volume: 600n * USD, pnl: 100n * USD, fees: 10n * USD, funding: 5n * USD },
  /** Alice 20 days ago: with today, enough for 30d (10 trades, $1,200). */
  aliceEarlier: { back: 20, trades: 5, volume: 600n * USD, pnl: 20n * USD, fees: 0n, funding: 0n },
  /** Bob 7 days ago: outside 7d (today − 6 is its first day), inside 30d. */
  bobWeekAgo: { back: 7, trades: 10, volume: 2_000n * USD, pnl: 300n * USD, fees: 0n, funding: 0n },
} as const;

/** Lifetime totals (All). */
export const LB_TOTALS = {
  alice: {
    pnl: 1_000n * USD,
    fees: 100n * USD,
    funding: 50n * USD,
    borrow: 25n * USD,
    volume: 5_000n * USD,
    trades: 20,
  },
  bob: { pnl: 400n * USD, fees: 0n, funding: 0n, borrow: 0n, volume: 9_000n * USD, trades: 30 },
  /** Alice on mainnet — she isn't listed there, so this must never rank. */
  aliceMainnet: { pnl: 9_999n * USD, fees: 0n, funding: 0n, borrow: 0n, volume: 9_999n * USD, trades: 99 },
  frankMainnet: { pnl: 50n * USD, fees: 0n, funding: 0n, borrow: 0n, volume: 2_000n * USD, trades: 12 },
} as const;

/** Weekly Top Trades: Alice shares trades; Carol's better close is hidden because she doesn't. */
export const LB_TOP = {
  alice: { pnl: 50n * USD, notional: 200n * USD },
  carol: { pnl: 900n * USD, notional: 200n * USD },
} as const;

/** Feed fixtures. */
export const FEED_FIX = {
  notional: 250n * USD,
  closePnl: 40n * USD,
  closeFee: 2n * USD,
  /** Seconds before "now" for a fill that predates the trader's sharing start. */
  beforeSharing: 3_600,
  /** Seconds after "now" for fills after the trader's sharing start. */
  after: 5,
  page: 2,
} as const;
