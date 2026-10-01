/**
 * Perpl (Monad mainnet 143, testnet 10143): the market registry and the venue's public market-data API. `@senryo/identity`
 * re-exports `PERPL_MARKETS` for its marks; the discovery list (`./discovery.ts`) is built from the mainnet table.
 *
 * Market ids are Perpl's own (`/v1/pub/context` `markets[].id` = the Exchange's `perpId`), read live 1 Oct 2026 — the
 * docs' tables are stale (context/08-integrations/agora-ausd-and-perpl.md §2.1). NEAR (100) was listed on mainnet on
 * 30 Sep 2026.
 */
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

/** Perpl market ids per network, by ticker. */
export const PERPL_MARKETS: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  [MAINNET_CHAIN_ID]: { BTC: 1, MON: 10, ETH: 20, SOL: 31, HYPE: 40, ZEC: 50, LIT: 60, VVV: 70, PUMP: 90, NEAR: 100 },
  [TESTNET_CHAIN_ID]: { BTC: 16, ETH: 32, SOL: 48, MON: 64, ZEC: 256, LIT: 272, PUMP: 320, NEAR: 336 },
};

/** What each Perpl ticker is called (the asset, not the perp). */
export const PERPL_ASSET_NAMES: Readonly<Record<string, string>> = {
  BTC: "Bitcoin",
  ETH: "Ether",
  SOL: "Solana",
  MON: "Monad",
  HYPE: "Hyperliquid",
  ZEC: "Zcash",
  LIT: "Lighter",
  VVV: "Venice",
  PUMP: "Pump",
  NEAR: "NEAR",
};

/**
 * Perpl's public REST API on mainnet (keyless; `/api` is part of the base). Market data used here
 * (references/perpl-api-docs/rest-endpoints.md @25ab6e2):
 *  - `GET /v1/market-data/ticker` — every market's state: `lst` last trade, `prv` "price 24h ago", `dva` daily volume
 *    (AUSD base units), stamped with the block it is current as of; a market without state yet is absent
 *  - `GET /v1/market-data/:id/candles/:resolution/:from-:to` — OHLC in the market's scaled prices, ≤ 1024 per call,
 *    resolutions 60…86400 s (all five chart intervals are among them); an empty `d` when nothing traded
 *  - `GET /v1/pub/context` — per-market config, including `funding_interval_sec`
 * Browsers: CORS answers only Perpl's own origin, so a web build gets the onchain fields and none of these; native
 * `fetch` sends no Origin and is served (checked 1 Oct 2026).
 */
export const PERPL_API = "https://app.perpl.xyz/api";
/** The web app a Perpl market lives on (attribution beside its chart). */
export const PERPL_APP_URL = "https://app.perpl.xyz";
/** `GET /v1/market-data/:id/candles` answers at most this many candles per request (more is HTTP 400). */
export const PERPL_MAX_CANDLES = 1024;

/**
 * The Exchange's view used for prices (`MAINNET_EXTERNAL.perplExchange`, UUPS proxy, `getContractVersion()` 1.7.5):
 * `getPerpetualInfo(uint256 perpId)` → mark / last / oracle price with their timestamps, price and lot decimals, long
 * and short open interest, the last applied funding rate and the market status. ABI subset of
 * github.com/PerplFoundation/dex-sdk `crates/sdk/abi/dex/Exchange.json` @01b9910 (MIT). Read 1 Oct 2026 for all ten
 * markets: every value equal to the REST ticker at the same block (`mrk`, `orl`, `oi`).
 */
export const PERPL_PRICE_SOURCE = {
  method: "getPerpetualInfo(uint256)",
  abi: "PerplFoundation/dex-sdk crates/sdk/abi/dex/Exchange.json @01b9910 (MIT)",
  /** `status` 0 is Paused (dex-sdk `state/perpetual.rs`: `is_paused: info.status == 0`). */
  pausedStatus: 0,
  /** `fundingRatePct100k` is per funding interval, in 1e-5 (dex-sdk `FUNDING_RATE_SCALE` = 5). */
  fundingRateDecimals: 5,
} as const;
