/**
 * J11 spot tokens (S1b.16, v2-plan "Spot tokens"): Monad mainnet tokens bought and sold with USDC through Uniswap v4 —
 * the same PoolManager / Quoter / Universal Router as the USDC↔AUSD collateral swap (`MAINNET_EXTERNAL.uniswapV4`).
 * Mainnet only: Uniswap v4 has no pools on testnet 10143, so Practice has no spot tokens.
 *
 * The list is generated, never typed in: `pnpm --filter @senryo/drive spot-tokens` reads the pinned
 * `monad-crypto/token-list` mainnet list, finds each token's deepest hook-free v4 pool against USDC, AUSD or native MON,
 * verifies it onchain and writes `./generated/spot-tokens.ts`. Logos come through `@senryo/identity`'s marks pipeline
 * from the same list (`spec.from = "monad-token-list"`), with their provenance.
 */

/** Native MON is `address(0)` in Uniswap v4 (and in the token list). */
export const SPOT_NATIVE = "0x0000000000000000000000000000000000000000" as const;

/** What a token's own pool is quoted in. Buys always pay USDC; AUSD and MON reach USDC through their own pools. */
export type SpotQuote = "USDC" | "AUSD" | "MON";

export interface SpotPoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  /** LP fee in pips (1e-6): 500 = 0.05 %. */
  fee: number;
  tickSpacing: number;
  /** Always `address(0)`: hooked pools are skipped (a hook can change the price or take a fee per swap). */
  hooks: `0x${string}`;
}

export interface SpotPool {
  key: SpotPoolKey;
  /** keccak256(abi.encode(key)) — StateView's and GeckoTerminal's pool id. */
  poolId: `0x${string}`;
}

export interface SpotToken {
  symbol: string;
  name: string;
  /** `SPOT_NATIVE` for MON. */
  address: `0x${string}`;
  decimals: number;
  native: boolean;
  /** `@senryo/identity` entity id: `token:143:<address>`, or `native:143:MON`. */
  mark: string;
  /** The token's folder in `monad-crypto/token-list` (`mainnet/<dir>/logo.<ext>`) and its logo file. */
  list: { dir: string; logo: string };
  coingeckoId?: string;
  quote: SpotQuote;
  /** The deepest hook-free pool of this token against `quote`; the chart's price history is this pool's. */
  pool: SpotPool;
  /** USDC → token, hop by hop (the last hop is `pool`); a sell walks it backwards. */
  route: readonly SpotPool[];
  /** At generation: a `SPOT_REFERENCE_USD` buy along `route` moved the price this much beyond the LP fees. */
  impactBps: number;
}

/** GeckoTerminal's public API (keyless, IP rate-limited — 10 calls/min on the free tier; docs.coingecko.com). */
export const GECKOTERMINAL_API = "https://api.geckoterminal.com/api/v2";
/** GeckoTerminal's network slug for Monad mainnet (`/networks` lists `{ id: "monad" }`). */
export const GECKOTERMINAL_NETWORK = "monad";
/** GeckoTerminal's dex id for Uniswap v4 on Monad; a v4 pool's address there is its PoolId. */
export const GECKOTERMINAL_UNISWAP_V4 = "uniswap-v4-monad";
/**
 * Shown wherever GeckoTerminal data is (the spot chart). CoinGecko's attribution guide
 * (brand.coingecko.com/resources/attribution-guide) gives this text for on-chain data and says never to attribute it
 * to the wrong source; the CoinGecko API Terms (coingecko.com/en/api_terms §4.4–4.5) make attribution a condition and
 * forbid re-distributing or syndicating API access (§4.1.6) — so devices call it directly, nothing is re-served.
 */
export const GECKOTERMINAL_ATTRIBUTION = {
  text: "On-chain data provided by GeckoTerminal",
  url: "https://www.geckoterminal.com",
  poolUrl: (poolId: string) => `https://www.geckoterminal.com/${GECKOTERMINAL_NETWORK}/pools/${poolId}`,
} as const;

/**
 * Monad's official token list (github.com/monad-crypto/token-list, no LICENSE file; its README: inclusion "does not
 * imply endorsement, verification, or approval"). Pinned by commit so the list and its logos are reproducible.
 */
export const MONAD_TOKEN_LIST = {
  repo: "https://github.com/monad-crypto/token-list",
  raw: "https://raw.githubusercontent.com/monad-crypto/token-list",
  commit: "20779d2ccf0e5d305d3790a21dcef4cb73342c60",
  mainnetFile: "tokenlist-mainnet.json",
} as const;

/** The generated list sizes depth with a buy of this many dollars of USDC (see `SpotToken.impactBps`). */
export const SPOT_REFERENCE_USD = 1_000;
