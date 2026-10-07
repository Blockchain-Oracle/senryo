/**
 * Read-only discovery (review S03; v2-plan §2 "market breadth", W6; D-175, D-220): instruments a user can look at — a
 * real price, its 24 h change and a chart — while trading them here is gated. Three separate facts per instrument:
 *  - its data: authoritative read-only sources (`sources`), or none, with the reason (`UNPRICED_INSTRUMENTS`);
 *  - its execution on each network (`execution`): a stage still to land, or a named blocker — quoted from the plan and
 *    the decisions, never inferred;
 *  - its identity: a calculated tokenized-equity feed prices the xStocks **wrapper** (wSPYx), not the share, so every
 *    one carries the wrapper's name and a disclosure, and is never presented as ordinary equity execution.
 * Prices are read on Monad mainnet (143) in both modes, like the spot tokens and the metal charts (D-163).
 */
import { MAINNET_EXTERNAL } from "./markets.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";
import { PERPL_API, PERPL_ASSET_NAMES, PERPL_MARKETS, PERPL_PRICE_SOURCE } from "./perpl.ts";

export type DiscoveryClass = "crypto" | "equity-calculated";
export type DiscoveryVenue = "Perpl" | "Chainlink calculated feed";
export type DiscoveryId = `perpl:${string}` | `chainlink:${string}`;

/**
 * Whether an instrument trades on a network: open (and where), a named stage that brings it, or a named blocker
 * (v2-plan §7).
 */
export type ExecutionGate =
  | { state: "open"; reason: string; source: string }
  | { state: "unavailable"; reason: string; source: string }
  | { state: "blocked"; blocker: "B2" | "B10"; reason: string; unblocks: string; source: string };

/** One field's source: what is read, where, how, and where its interface comes from. */
export interface DataSource {
  what: string;
  where: string;
  method: string;
  provenance: string;
}

interface DiscoveryBase {
  id: DiscoveryId;
  /** The row's ticker: the Perpl ticker ("BTC"), or the underlying's ("SPY"). */
  symbol: string;
  name: string;
  class: DiscoveryClass;
  venue: DiscoveryVenue;
  execution: Readonly<Record<ChainId, ExecutionGate>>;
  sources: { price: DataSource; change24h: DataSource; history: DataSource };
}

export interface PerplInstrument extends DiscoveryBase {
  class: "crypto";
  venue: "Perpl";
  /** Perpl's mainnet market id (`perpId`). */
  perplMarketId: number;
}

export interface CalculatedFeed {
  /** EACAggregatorProxy on 143 (read through it: its round ids carry the phase). */
  proxy: `0x${string}`;
  /** The phase-1 OCR2 aggregator behind it (`aggregator()`, 1 Oct 2026) — what the indexer listens to. */
  aggregator: `0x${string}`;
  /** `description()`, asserted on every read. */
  description: string;
  decimals: number;
  heartbeatSec: number;
  /** Deviation threshold (bps): 0.05 %, measured in D-220 and the directory's value. */
  deviationBps: number;
  /** The indexer's feed id once these feeds are indexed (indexer/config.yaml `FeedW…X`). */
  indexerFeed: string;
}

export interface CalculatedEquityInstrument extends DiscoveryBase {
  class: "equity-calculated";
  venue: "Chainlink calculated feed";
  underlying: { ticker: string; name: string };
  /** The tokenized instrument the feed actually prices (Chainlink directory `assetName`). */
  wrapper: { symbol: string; name: string };
  /** "SPY via wSPYx calculated feed" — the label that keeps the wrapper visible. */
  displayName: string;
  disclosure: string;
  feed: CalculatedFeed;
}

export type DiscoveryInstrument = PerplInstrument | CalculatedEquityInstrument;

/** An instrument in the universe with no authoritative price source on Monad yet. */
export interface UnpricedInstrument {
  id: `unpriced:${string}`;
  symbol: string;
  name: string;
  class: "commodity";
  data: { state: "unavailable"; reason: string; source: string };
  execution: Readonly<Record<ChainId, ExecutionGate>>;
}

/**
 * A calculated feed is quiet past heartbeat + this grace: outside its 24/5 session or stalled (SessionOracle's own
 * freshness rule, Constants.sol `FEED_GRACE`).
 */
export const CALCULATED_FEED_GRACE_SEC = 600;
/** The six calculated feeds: 8 decimals, 3,600 s heartbeat, 0.05 % deviation (directory + D-220). */
const FEED_DECIMALS = 8;
const FEED_HEARTBEAT_SEC = 3_600;
const FEED_DEVIATION_BPS = 5;
/** Chainlink's Monad mainnet directory (proxy, aggregator, heartbeat, threshold, `assetName`), read 1 Oct 2026. */
export const CHAINLINK_MONAD_DIRECTORY = "https://reference-data-directory.vercel.app/feeds-monad-mainnet.json";

const both = (gate: ExecutionGate): Readonly<Record<ChainId, ExecutionGate>> => ({
  [MAINNET_CHAIN_ID]: gate,
  [TESTNET_CHAIN_ID]: gate,
});

// ---------------------------------------------------------------- Perpl crypto

const PERPL_EXECUTION: Readonly<Record<ChainId, ExecutionGate>> = {
  [MAINNET_CHAIN_ID]: {
    state: "open",
    reason: "Trades on Perpl from your Senryo account",
    source: "flow book C4 · D1 (packages/chain perpl, features/perpl)",
  },
  [TESTNET_CHAIN_ID]: {
    state: "open",
    reason: "Trades with test AUSD on Perpl’s Monad Testnet deployment",
    source: "2026-10-07 funded-faucet and unpaused-market probes · native Perpl Practice",
  },
};

const PERPL_SOURCES: PerplInstrument["sources"] = {
  price: {
    what: "Mark price, its timestamp, open interest and the last funding rate",
    where: `Perpl Exchange ${MAINNET_EXTERNAL.perplExchange} on Monad mainnet`,
    method: PERPL_PRICE_SOURCE.method,
    provenance: PERPL_PRICE_SOURCE.abi,
  },
  change24h: {
    what: "Last trade vs Perpl's price 24 h ago (Perpl's own formula), and 24 h volume",
    where: `${PERPL_API}/v1/market-data/ticker`,
    method: "GET · fields lst, prv, dva",
    provenance: "references/perpl-api-docs rest-endpoints.md @25ab6e2",
  },
  history: {
    what: "Trade candles (5 m … 1 d)",
    where: `${PERPL_API}/v1/market-data/:id/candles/:resolution/:from-:to`,
    method: "GET",
    provenance: "references/perpl-api-docs rest-endpoints.md @25ab6e2",
  },
};

export const PERPL_INSTRUMENTS: readonly PerplInstrument[] = Object.entries(PERPL_MARKETS[MAINNET_CHAIN_ID] ?? {}).map(
  ([symbol, perplMarketId]) => ({
    id: `perpl:${symbol}`,
    symbol,
    name: PERPL_ASSET_NAMES[symbol] ?? symbol,
    class: "crypto",
    venue: "Perpl",
    perplMarketId,
    execution: PERPL_EXECUTION,
    sources: PERPL_SOURCES,
  }),
);

// ---------------------------------------------------------------- calculated equities (D-220)

/** D-220 (a): the calm index ETFs. */
const LISTABLE: ExecutionGate = {
  state: "unavailable",
  reason: "Its feed passed research; trading opens only if a timelocked listing is approved",
  source: "D-220 (a) · listing is a lead/user call [OK?]",
};

/** D-220 (b): single names and EWY — the jumps a usable spread can't cover. */
const jumpy = (maxJump: string, perDay: string): ExecutionGate => ({
  state: "blocked",
  blocker: "B2",
  reason: `Its price can jump ${maxJump} in one update (${perDay}) — more than a usable spread covers`,
  unblocks: "Chainlink Data Streams, or 30 days of feed history that includes an earnings report",
  source: "D-220 (b) · v2-plan §7 B2 · Q-008 (Data Streams)",
});

const CALCULATED_DISCLOSURE = "Indicative · calculated feed (tokenized wrapper) · trading unavailable";

function feedSources(proxy: string, description: string): CalculatedEquityInstrument["sources"] {
  const where = `${description} proxy ${proxy} on Monad mainnet`;
  const provenance = `AggregatorV3Interface (@senryo/contracts aggregatorV3InterfaceAbi); ${CHAINLINK_MONAD_DIRECTORY}`;
  return {
    price: {
      what: "Latest calculated wrapper price and its updatedAt",
      where,
      method: "latestRoundData()",
      provenance,
    },
    change24h: {
      what: "Latest round vs the last round ≥ 24 h before it",
      where,
      method: "getRoundData(uint80), searched by updatedAt",
      provenance,
    },
    history: {
      what: "OHLC from every round in the window (no round, no candle)",
      where: `the indexer's Candle rows once indexed; until then ${where}`,
      method: "Candles(feed) · getRoundData(uint80) walked back",
      provenance,
    },
  };
}

interface EquitySpec {
  ticker: string;
  name: string;
  wrapper: string;
  wrapperName: string;
  proxy: `0x${string}`;
  aggregator: `0x${string}`;
  gate: ExecutionGate;
}

function calculated(spec: EquitySpec): CalculatedEquityInstrument {
  const description = `${spec.wrapper}-USD (Calculated)`;
  return {
    id: `chainlink:${spec.wrapper}`,
    symbol: spec.ticker,
    name: spec.name,
    class: "equity-calculated",
    venue: "Chainlink calculated feed",
    underlying: { ticker: spec.ticker, name: spec.name },
    wrapper: { symbol: spec.wrapper, name: spec.wrapperName },
    displayName: `${spec.ticker} via ${spec.wrapper} calculated feed`,
    disclosure: CALCULATED_DISCLOSURE,
    feed: {
      proxy: spec.proxy,
      aggregator: spec.aggregator,
      description,
      decimals: FEED_DECIMALS,
      heartbeatSec: FEED_HEARTBEAT_SEC,
      deviationBps: FEED_DEVIATION_BPS,
      indexerFeed: spec.wrapper,
    },
    execution: both(spec.gate),
    sources: feedSources(spec.proxy, description),
  };
}

/**
 * Proxies from D-220; each verified onchain 1 Oct 2026: `description()` "w<X>x-USD (Calculated)", `decimals()` 8,
 * `phaseId()` 1, `aggregator()` = the directory's `contractAddress`. Jump figures are D-220's (9.6 days, 21–30 Sep).
 */
export const CALCULATED_EQUITIES: readonly CalculatedEquityInstrument[] = [
  calculated({
    ticker: "SPY",
    name: "SPDR S&P 500 ETF",
    wrapper: "wSPYx",
    wrapperName: "Wrapped SPY xStock",
    proxy: "0x2e2dA5717eDE960F8b77Af4cFcBDC4Ca3099006D",
    aggregator: "0x652Cb99415670fE21D190cb6cBc82652b916Eb43",
    gate: LISTABLE,
  }),
  calculated({
    ticker: "QQQ",
    name: "Invesco QQQ",
    wrapper: "wQQQx",
    wrapperName: "Wrapped QQQ xStock",
    proxy: "0x7CA45B17D8D43059a222dEC5d991B613F61c02d9",
    aggregator: "0xd2AA78Fa96E7B49e1D678151818204B638fb1293",
    gate: LISTABLE,
  }),
  calculated({
    ticker: "NVDA",
    name: "Nvidia",
    wrapper: "wNVDAx",
    wrapperName: "Wrapped NVIDIA xStock",
    proxy: "0x03ffa4673c060339E6a8E5Ba1a12B3301c966bf0",
    aggregator: "0x3C04C0c74EEe95a27d62efA8FC9Da0f2b7f4578E",
    gate: jumpy("0.87%", "2.2 a day over 0.3%"),
  }),
  calculated({
    ticker: "TSLA",
    name: "Tesla",
    wrapper: "wTSLAx",
    wrapperName: "Wrapped Tesla xStock",
    proxy: "0xE42022cCe1913626AE4297B99291d3Ba24Cc9281",
    aggregator: "0x81eDD5F657b28d7E38192B33BD3901179673c780",
    gate: jumpy("1.49%", "at the US open; 2.0 a day over 0.5%"),
  }),
  calculated({
    ticker: "SPCX",
    name: "SpaceX",
    wrapper: "wSPCXx",
    wrapperName: "Wrapped SpaceX xStock",
    proxy: "0x7577154038de77668d0188baF47707EDcd86d0b3",
    aggregator: "0x9568322beD79945f814f8Be94C7fD47e7606C7a3",
    gate: jumpy("1.16%", "3.5 a day over 0.5%"),
  }),
  calculated({
    ticker: "EWY",
    name: "iShares MSCI South Korea ETF",
    wrapper: "wEWYx",
    wrapperName: "Wrapped EWY xStock",
    proxy: "0x54D1645F9C1338f63407Fa64156eCeD9e195AB25",
    aggregator: "0xFb075BA1535A190d099c46573D341d5435370B67",
    gate: jumpy("0.77%", "1.6 a day over 0.3%"),
  }),
];

export const DISCOVERY_INSTRUMENTS: readonly DiscoveryInstrument[] = [...PERPL_INSTRUMENTS, ...CALCULATED_EQUITIES];

/**
 * In the universe (v2-plan §6 "Equities/indices/oil") with no price source: Chainlink's Monad directory lists no oil
 * feed (its two commodities are XAU and XAG, read 1 Oct 2026).
 */
export const UNPRICED_INSTRUMENTS: readonly UnpricedInstrument[] = [
  {
    id: "unpriced:OIL",
    symbol: "OIL",
    name: "Crude oil (WTI / Brent)",
    class: "commodity",
    data: {
      state: "unavailable",
      reason: "No price feed on Monad: WTI and Brent are on Chainlink Data Streams only (credentials asked, Q-008)",
      source: "v2-plan W6 step 3",
    },
    execution: both({
      state: "blocked",
      blocker: "B2",
      reason: "Needs a live oil price feed",
      unblocks: "Chainlink Data Streams (Q-008) or a Pyth plan (Q-014, paid → [OK?])",
      source: "v2-plan §7 B2",
    }),
  },
];

export function discoveryInstrument(id: string): DiscoveryInstrument | undefined {
  return DISCOVERY_INSTRUMENTS.find((i) => i.id === id);
}
