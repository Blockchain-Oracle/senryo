/**
 * Canonical entity ids. A token is its chain + contract, a market its venue + chain + market id, a chain its CAIP-2
 * id — so two tickers that collide never share artwork by accident (study 08 "Asset-delivery contract").
 */

export type EntityId = string;

/** CAIP-2 references for the non-EVM networks shown in funding routes. */
export const CAIP2 = {
  bitcoin: "bip122:000000000019d6689c085ae165831e93",
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  tron: "tron:0x2b6653dc",
  near: "near:mainnet",
} as const;

export const ids = {
  /** `chain:eip155:143` */
  evmChain: (chainId: number): EntityId => `chain:eip155:${chainId}`,
  /** `chain:bip122:…`, `chain:solana:…` */
  caipChain: (caip2: string): EntityId => `chain:${caip2}`,
  /** `token:143:0x…` (address lower-cased). */
  token: (chainId: number, address: string): EntityId => `token:${chainId}:${address.toLowerCase()}`,
  /** `token:solana:EPjF…` — Solana mints are base58 and case-sensitive, so they are kept as given. */
  splToken: (mint: string): EntityId => `token:solana:${mint}`,
  /** `native:143:MON` */
  native: (chainRef: number | string, symbol: string): EntityId => `native:${chainRef}:${symbol}`,
  /** `market:BTC` — a prediction market from the catalogue (`packages/config/src/catalog.ts`, D-268). */
  market: (symbol: string): EntityId => `market:${symbol}`,
  /** `fx:EURUSD` — the FX pair identity until each pair has an onchain market id (W6). */
  fxPair: (base: string, quote: string): EntityId => `fx:${base}${quote}`,
  /** `equity:NVDA` — the underlying company, until an instrument for it has a venue market id. */
  equity: (ticker: string): EntityId => `equity:${ticker}`,
  venue: (slug: string): EntityId => `venue:${slug}`,
  provider: (slug: string): EntityId => `provider:${slug}`,
  exchange: (slug: string): EntityId => `exchange:${slug}`,
  brand: (slug: string): EntityId => `brand:${slug}`,
  /** `league:nhl` — a competition events are about (`LeagueKey` in packages/config/src/events.ts). */
  league: (key: string): EntityId => `league:${key}`,
} as const;
