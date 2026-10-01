/**
 * Indexer constants. The indexer is outside the pnpm workspace (own lockfile, own Docker context), so it cannot import
 * @senryo/config or @senryo/core; values that mirror them name their source. Money stays bigint base units.
 */

// ---------------------------------------------------------------- chains (packages/config/src/networks.ts)
export const MAINNET_CHAIN_ID = 143;
export const TESTNET_CHAIN_ID = 10143;

// ---------------------------------------------------------------- units (contracts/specs: usd6, 1e18 prices/sizes)
export const USD6_DECIMALS = 6;
export const WAD_DECIMALS = 18;
export const TEN = 10n;
export const WAD = TEN ** 18n;
/** size (1e18) × price (1e18) = usd36 → usd6 */
export const SIZE_PRICE_TO_USD6 = TEN ** 30n;
/** Chainlink XAU/USD and XAG/USD answers (8 decimals; read onchain 2026-09-30) and the testnet mirrors (D-055). */
export const FEED_DECIMALS = 8;
/** Chainlink FX answers on Monad (EUR/GBP/JPY/CHF/CAD / USD: 18 decimals, read onchain 2026-09-30) and their mirrors. */
export const FX_FEED_DECIMALS = 18;
/** Perpl collateral (AUSD) CNS scale equals usd6 (context/08-integrations/envio.md §5). */
export const PERPL_CNS_DECIMALS = USD6_DECIMALS;

// ---------------------------------------------------------------- time
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
const CANDLE_MINUTES_5 = 5;
const CANDLE_MINUTES_15 = 15;
const CANDLE_HOURS_4 = 4;
/** Candle intervals (seconds): 5m, 15m, 1h, 4h, 1d. */
export const CANDLE_INTERVALS = [
  CANDLE_MINUTES_5 * SECONDS_PER_MINUTE,
  CANDLE_MINUTES_15 * SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  CANDLE_HOURS_4 * SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
] as const;

// ---------------------------------------------------------------- our markets (contracts/script/SeedConstants.sol)
/** GOLD_MARKET = 0, SILVER_MARKET = 1, EUR_MARKET … CAD_MARKET = 2…6 (S8.23; FX quotes in the feed's orientation). */
export const OUR_MARKETS: Readonly<Record<number, { symbol: string; name: string }>> = {
  0: { symbol: "XAU", name: "Gold" },
  1: { symbol: "XAG", name: "Silver" },
  2: { symbol: "EUR", name: "Euro" },
  3: { symbol: "GBP", name: "British pound" },
  4: { symbol: "JPY", name: "Japanese yen" },
  5: { symbol: "CHF", name: "Swiss franc" },
  6: { symbol: "CAD", name: "Canadian dollar" },
};

// ---------------------------------------------------------------- Solidity enums (contracts/src/libraries/Types.sol)
export const DEPOSIT_SOURCES = ["DIRECT", "AURORA", "INBOX", "VOUCHER"] as const;
export const POSITION_KINDS = ["OPEN", "INCREASE", "DECREASE", "CLOSE", "LIQUIDATE", "TRIGGER"] as const;
export const RELEASE_REASONS = ["OPERATOR", "EXPIRED", "RELEASE_ONLY", "CAPTURE_REMAINDER"] as const;
export const MARKET_STATUSES = ["OPEN", "REOPENING", "CLOSED", "STALE", "CIRCUIT", "HALTED"] as const;
/** Perpl `positionType`: 0 = long, 1 = short (perpl-dex-sdk state/position.rs). */
export const PERPL_POSITION_TYPES = ["LONG", "SHORT"] as const;

// ---------------------------------------------------------------- ids
export const GLOBAL_ID = "global";
export const PERPL_CURSOR_ID = "cursor";
export const OURS_PREFIX = "ours";
export const PERPL_PREFIX = "perpl";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
/** LP seed shares go here (contracts Constants.DEAD_ADDRESS) — an LP row, never a User. */
export const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";
/** Account slots of `SenryoCore.account(user)` (AccountLedger). */
export const COLLATERAL_SLOTS = ["AUSD", "USDC"] as const;
export type CollateralSlot = (typeof COLLATERAL_SLOTS)[number];

// ---------------------------------------------------------------- runtime defaults (overridable, see src/lib/env.ts)
/**
 * Perpl's noisy events (positions, fills, funding, collateral) start here on 143 — before our mainnet launch there
 * are no app users to attribute. ≈ 2026-09-30 12:00Z; S8 sets the real launch block via ENVIO_APP_LAUNCH_BLOCK_143.
 * Mirrors the `ENVIO_FEED_WATCH_START_BLOCK_143` default in config.yaml.
 */
export const DEFAULT_APP_LAUNCH_BLOCK_143 = 109_200_000;
/** Archive RPCs (packages/config/src/networks.ts `archiveRpcHttp`): eth_call at the event's block. */
export const DEFAULT_ARCHIVE_RPC: Readonly<Record<number, string>> = {
  [MAINNET_CHAIN_ID]: "https://rpc-mainnet.monadinfra.com",
  [TESTNET_CHAIN_ID]: "https://rpc-testnet.monadinfra.com",
};
/** Effects never hammer a public endpoint: calls per second per chain. */
export const RPC_EFFECT_CALLS_PER_SECOND = 10;
/** How long a proxy's phase list (its aggregator history) is trusted before a re-read on an unknown aggregator. */
export const PROXY_PHASES_TTL_MS = 10 * 60 * 1000;
/**
 * Chainlink proxies on Monad mainnet (ids-and-txs.md, contracts/script/SeedConstants.sol; description() and
 * decimals() read 2026-09-30).
 */
export const CHAINLINK_PROXIES: ReadonlyArray<{ proxy: `0x${string}`; symbol: FeedSymbol }> = [
  { proxy: "0x61dd33a34e47a181ee02e42ee0546a3da808f1b4", symbol: "XAU" },
  { proxy: "0x29beb7e730f09d33417357dbed020b549fdf7db4", symbol: "XAG" },
  { proxy: "0x00d7e359c8ce46168efdd4d65b708ffb16c4b99a", symbol: "EUR" },
  { proxy: "0x1ffc8b75a16fffbd7879f042b580f7607dcf5c30", symbol: "GBP" },
  { proxy: "0xf64664ea54ce47ecc7a1816c49d1bc6def828927", symbol: "JPY" },
  { proxy: "0x6dba7f3a7b5b7c1079337104cad14d19150f6b8d", symbol: "CHF" },
  { proxy: "0x3293ea5650e9f8c4091642b7eb1c46cfee5197ca", symbol: "CAD" },
];
export type FeedSymbol = "XAU" | "XAG" | "EUR" | "GBP" | "JPY" | "CHF" | "CAD";
/** Answer decimals per feed (the price is stored at 1e18). */
export const FEED_DECIMALS_OF: Readonly<Record<FeedSymbol, number>> = {
  XAU: FEED_DECIMALS,
  XAG: FEED_DECIMALS,
  EUR: FX_FEED_DECIMALS,
  GBP: FX_FEED_DECIMALS,
  JPY: FX_FEED_DECIMALS,
  CHF: FX_FEED_DECIMALS,
  CAD: FX_FEED_DECIMALS,
};
