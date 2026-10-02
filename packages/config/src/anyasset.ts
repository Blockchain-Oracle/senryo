/**
 * The any-asset layer (plan §0.8, D6): holdings discovery for any ERC-20 at an address, the verified list, prices,
 * and any↔any swap quotes through public aggregators. Plain data: hosts, ids and pinned addresses. The api
 * (`services/api` `/v1/holdings`, `/v1/swap/quote`) reads these; `packages/chain` builds the sends.
 */
import { ENGINE_MARKETS, MAINNET_EXTERNAL } from "./markets.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";
import { GECKOTERMINAL_API, GECKOTERMINAL_NETWORK, MONAD_TOKEN_LIST, SPOT_NATIVE } from "./spot.ts";

// ---------------------------------------------------------------- holdings discovery

/**
 * Envio HyperSync (docs.envio.dev/docs/HyperSync): ERC-20 `Transfer` logs with the address in topic1 or topic2 give
 * every token the address ever sent or received. Token-gated (Bearer); the budget measured on 2 Oct was
 * 15,000 units per 60 s at 1,000 per query, shared by every user of the token.
 */
export const HYPERSYNC_URL: Readonly<Record<ChainId, string>> = {
  [MAINNET_CHAIN_ID]: "https://143.hypersync.xyz",
  [TESTNET_CHAIN_ID]: "https://10143.hypersync.xyz",
};

/** keccak256("Transfer(address,address,uint256)") — ERC-20 and ERC-721 share it (721 indexes a 4th topic). */
export const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

/**
 * Verified = listed on Monad's token list, matched by ADDRESS (never by symbol). Holdings follow the list as it is
 * today (`main`), unlike the generated spot tokens, which stay on the pinned commit for reproducible logos.
 */
export const TOKEN_LIST_URL: Readonly<Record<ChainId, string>> = {
  [MAINNET_CHAIN_ID]: `${MONAD_TOKEN_LIST.raw}/main/tokenlist-mainnet.json`,
  [TESTNET_CHAIN_ID]: `${MONAD_TOKEN_LIST.raw}/main/tokenlist-testnet.json`,
};

/** Alchemy Portfolio API (fallback discovery, key from the api env): `POST {base}/{key}/assets/tokens/by-address`. */
export const ALCHEMY_DATA_API = "https://api.g.alchemy.com/data/v1";
export const ALCHEMY_NETWORK: Readonly<Record<ChainId, string>> = {
  [MAINNET_CHAIN_ID]: "monad-mainnet",
  [TESTNET_CHAIN_ID]: "monad-testnet",
};

/** GeckoTerminal keyless endpoints (prices for verified tokens; images for unverified ones). */
export const GECKOTERMINAL_TOKEN_PRICE_URL = `${GECKOTERMINAL_API}/simple/networks/${GECKOTERMINAL_NETWORK}/token_price`;
export const GECKOTERMINAL_TOKENS_MULTI_URL = `${GECKOTERMINAL_API}/networks/${GECKOTERMINAL_NETWORK}/tokens/multi`;
/** Addresses per GeckoTerminal multi-token call (its documented maximum). */
export const GECKOTERMINAL_BATCH = 30;

/** Native MON in holdings and quotes: `address(0)`, as on the token list and in Monorail. */
export const NATIVE_TOKEN = SPOT_NATIVE;

/** Wrapped MON — native MON is priced as WMON. */
export const WMON: Readonly<Record<ChainId, `0x${string}`>> = {
  [MAINNET_CHAIN_ID]: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  [TESTNET_CHAIN_ID]: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541",
};

/** Mainnet tokens the product names (token list addresses, read 2 Oct 2026). */
export const MAINNET_TOKENS = {
  ausd: MAINNET_EXTERNAL.ausd,
  usdc: MAINNET_EXTERNAL.usdc,
  usdt0: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
  xaut0: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
  wmon: WMON[MAINNET_CHAIN_ID],
} as const;

/**
 * Independent reference prices for the price-impact rule (plan §0.8): aggregators and GeckoTerminal disagree on thin
 * markets (XAUt0 on 2 Oct: Monorail ≈ $3,948, KyberSwap ≈ $4,189, GeckoTerminal $4,877, XAU/USD feed $4,181). A token
 * listed here is valued with the Chainlink feed (XAUt0 = one troy ounce = XAU/USD); every other token uses the
 * GeckoTerminal price.
 */
const XAU_FEED = ENGINE_MARKETS.find((m) => m.symbol === "XAU")?.mainnetFeed;
export const REFERENCE_FEEDS: Readonly<Record<string, { feed: `0x${string}`; description: string }>> = XAU_FEED
  ? { [MAINNET_TOKENS.xaut0.toLowerCase()]: { feed: XAU_FEED, description: "XAU / USD" } }
  : {};
/** A metal feed answer older than this is not a reference (weekends close the market; 3 days covers Fri → Mon). */
export const REFERENCE_FEED_MAX_AGE_SEC = 259_200;

// ---------------------------------------------------------------- any ↔ any swaps (mainnet only)

/** Monorail Pathfinder v4 (free, 0 bps): `GET ?source&from&to&amount(human units)&sender&max_slippage(bps)`. */
export const MONORAIL_QUOTE_URL = "https://pathfinder.monorail.xyz/v4/quote";
export const MONORAIL_SOURCE = "senryo";
/** KyberSwap aggregator: `GET {api}/routes` → `POST {api}/route/build`, header `x-client-id`. */
export const KYBERSWAP_API = "https://aggregator-api.kyberswap.com/monad/api/v1";
export const KYBERSWAP_CLIENT_ID = "senryo";
/** KyberSwap's native-token placeholder. */
export const KYBERSWAP_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

export type SwapProvider = "monorail" | "kyberswap";

/** The only `to` an aggregator swap may call (`MAINNET_EXTERNAL.aggregators`). */
export const SWAP_ROUTERS: Readonly<Record<SwapProvider, `0x${string}`>> = MAINNET_EXTERNAL.aggregators;

export function isPinnedSwapRouter(to: string, provider?: SwapProvider): boolean {
  const pins = provider ? [SWAP_ROUTERS[provider]] : Object.values(SWAP_ROUTERS);
  return pins.some((pin) => pin.toLowerCase() === to.toLowerCase());
}

/** Default and largest slippage a quote is built with (bps): minOut = amountOut × (1 − slippage). */
export const SWAP_SLIPPAGE_BPS = 50;
export const SWAP_MAX_SLIPPAGE_BPS = 500;
/** KyberSwap's built calldata expires after this; a quote older than this is re-fetched before review. */
export const SWAP_DEADLINE_SEC = 300;

/** Only mainnet has aggregator coverage (no Monorail/KyberSwap on 10143). */
export function swapsSupported(chainId: ChainId): boolean {
  return chainId === MAINNET_CHAIN_ID;
}
