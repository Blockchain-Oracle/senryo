/**
 * Every known entity, keyed canonically (./ids.ts), bound to one artwork record (./art) or to a recorded gap. Label,
 * symbol, role, network/venue and artwork live on the same row, so a ticker can never borrow another entity's mark.
 * Practice (testnet) rows carry the real identity and say `practice: true`; the surface names the mode.
 */
import {
  ENGINE_MARKETS,
  type EngineSymbol,
  MAINNET_CHAIN_ID,
  MAINNET_EXTERNAL,
  PERPL_ASSET_NAMES,
  SPOT_TOKENS,
  TESTNET_CHAIN_ID,
} from "@senryo/config";
import { EXTERNAL_CHAIN_IDS, PERPL_MARKETS, PRACTICE_TOKENS, USDC_ELSEWHERE } from "./constants.ts";
import { CAIP2, ids, spotArtKey } from "./ids.ts";
import type { Entity } from "./types.ts";

const MONAD_NETWORKS = [
  { chainId: MAINNET_CHAIN_ID, practice: false },
  { chainId: TESTNET_CHAIN_ID, practice: true },
] as const;

/**
 * Our engine's markets → their original art: commodities as koban / chōgin (never an issuer's token art: XAU is not
 * Tether Gold), FX majors (S8.23) as the same flag-pair discs as their `fx:` pair identities.
 */
const ENGINE_ART: Readonly<Record<EngineSymbol, string>> = {
  XAU: "xau-koban",
  XAG: "xag-chogin",
  EUR: "fx-eur-usd",
  GBP: "fx-gbp-usd",
  JPY: "fx-jpy-usd",
  CHF: "fx-chf-usd",
  CAD: "fx-cad-usd",
};

/**
 * Crypto assets by ticker: artwork key (undefined = no artwork on file, see `gap`); display names come with the Perpl
 * registry (`PERPL_ASSET_NAMES`).
 */
const CRYPTO: Readonly<Record<string, { art?: string; gap?: string }>> = {
  BTC: { art: "bitcoin" },
  ETH: { art: "ethereum" },
  SOL: { art: "solana" },
  MON: { art: "monad" },
  HYPE: { art: "hyperliquid" },
  ZEC: { art: "zcash" },
  LIT: { art: "lighter" },
  VVV: { art: "venice" },
  PUMP: { art: "pump" },
  NEAR: { art: "near" },
};

/** Chains the any-asset bridges reach that no Senryo config needs elsewhere (EIP-155 ids). */
const OPTIMISM_CHAIN_ID = 10;
const AVALANCHE_CHAIN_ID = 43114;

const network = (id: string, name: string, art: string, practice = false): Entity => ({
  id,
  name,
  role: "network",
  instrument: "none",
  art,
  ...(practice ? { practice } : {}),
});

function monadRows(): Entity[] {
  return MONAD_NETWORKS.flatMap(({ chainId, practice }) => {
    const chain = ids.evmChain(chainId);
    const flag = practice ? { practice } : {};
    const tokens = practice ? PRACTICE_TOKENS : { ausd: MAINNET_EXTERNAL.ausd, usdc: MAINNET_EXTERNAL.usdc };
    const venue = { network: chain, venue: ids.venue("senryo"), role: "asset" as const };
    return [
      network(chain, practice ? "Monad Testnet" : "Monad", "monad", practice),
      {
        id: ids.native(chainId, "MON"),
        name: "Monad",
        symbol: "MON",
        role: "asset",
        instrument: "native-token",
        network: chain,
        art: "monad",
        ...flag,
      },
      {
        id: ids.token(chainId, tokens.ausd),
        name: "Agora USD",
        symbol: "AUSD",
        role: "asset",
        instrument: "stablecoin",
        network: chain,
        art: "ausd",
        ...flag,
      },
      {
        id: ids.token(chainId, tokens.usdc),
        name: "USD Coin",
        symbol: "USDC",
        role: "asset",
        instrument: "stablecoin",
        network: chain,
        art: "usdc",
        ...flag,
      },
      ...ENGINE_MARKETS.map((m) => ({
        id: ids.engineMarket(chainId, m.id),
        name: m.name,
        symbol: m.symbol,
        art: ENGINE_ART[m.symbol],
        instrument: m.category === "fx" ? ("fx-pair" as const) : ("commodity" as const),
        ...venue,
        ...flag,
      })),
    ];
  });
}

function perplRows(): Entity[] {
  return Object.entries(PERPL_MARKETS).flatMap(([chainId, markets]) =>
    Object.entries(markets).map(([symbol, marketId]) => {
      const asset = CRYPTO[symbol];
      const practice = Number(chainId) === TESTNET_CHAIN_ID;
      return {
        id: ids.perplMarket(Number(chainId), marketId),
        name: PERPL_ASSET_NAMES[symbol] ?? symbol,
        symbol,
        role: "asset",
        instrument: "perp",
        network: ids.evmChain(Number(chainId)),
        venue: ids.venue("perpl"),
        ...(asset?.art ? { art: asset.art } : { gap: asset?.gap ?? "first-party artwork not acquired yet" }),
        ...(practice ? { practice } : {}),
      } satisfies Entity;
    }),
  );
}

function externalRows(): Entity[] {
  const { ethereum, base, arbitrum, bnb, polygon } = EXTERNAL_CHAIN_IDS;
  const usdc = (id: string, chain: string): Entity => ({
    id,
    name: "USD Coin",
    symbol: "USDC",
    role: "asset",
    instrument: "stablecoin",
    network: chain,
    art: "usdc",
  });
  return [
    network(ids.evmChain(ethereum), "Ethereum", "ethereum"),
    network(ids.evmChain(base), "Base", "base"),
    network(ids.evmChain(arbitrum), "Arbitrum One", "arbitrum"),
    network(ids.caipChain(CAIP2.solana), "Solana", "solana"),
    network(ids.caipChain(CAIP2.bitcoin), "Bitcoin", "bitcoin"),
    network(ids.evmChain(bnb), "BNB Smart Chain", "bnb"),
    network(ids.evmChain(polygon), "Polygon", "polygon"),
    network(ids.evmChain(OPTIMISM_CHAIN_ID), "Optimism", "optimism"),
    network(ids.evmChain(AVALANCHE_CHAIN_ID), "Avalanche C-Chain", "avalanche"),
    network(ids.caipChain(CAIP2.tron), "TRON", "tron"),
    network(ids.caipChain(CAIP2.near), "NEAR", "near"),
    {
      id: ids.native(ethereum, "ETH"),
      name: "Ether",
      symbol: "ETH",
      role: "asset",
      instrument: "native-token",
      network: ids.evmChain(ethereum),
      art: "ethereum",
    },
    {
      id: ids.native(CAIP2.bitcoin, "BTC"),
      name: "Bitcoin",
      symbol: "BTC",
      role: "asset",
      instrument: "native-token",
      network: ids.caipChain(CAIP2.bitcoin),
      art: "bitcoin",
    },
    {
      id: ids.native(CAIP2.solana, "SOL"),
      name: "Solana",
      symbol: "SOL",
      role: "asset",
      instrument: "native-token",
      network: ids.caipChain(CAIP2.solana),
      art: "solana",
    },
    usdc(ids.token(base, USDC_ELSEWHERE.base), ids.evmChain(base)),
    usdc(ids.token(ethereum, USDC_ELSEWHERE.ethereum), ids.evmChain(ethereum)),
    usdc(ids.token(arbitrum, USDC_ELSEWHERE.arbitrum), ids.evmChain(arbitrum)),
    usdc(ids.splToken(USDC_ELSEWHERE.solanaMint), ids.caipChain(CAIP2.solana)),
  ];
}

/**
 * J11 spot tokens (the generated `SPOT_TOKENS`), each keyed by chain + contract with its own logo from Monad's token
 * list (`scripts/catalog.ts`). Native MON is the Monad row above, so it is not repeated here.
 */
const spotRows = (): Entity[] =>
  SPOT_TOKENS.filter((t) => !t.native).map((t) => ({
    id: ids.token(MAINNET_CHAIN_ID, t.address),
    name: t.name,
    symbol: t.symbol,
    role: "asset",
    instrument: "token",
    network: ids.evmChain(MAINNET_CHAIN_ID),
    art: spotArtKey(t.list.dir),
  }));

/** Owned assets beyond the spot list (D-248): Tether Gold on Monad, bought and held as a token (not the XAU perp). */
const XAUT0_ADDRESS = "0x01bFF41798a0BcF287b996046Ca68b395DbC1071";
const ownedRows = (): Entity[] => [
  {
    id: ids.token(MAINNET_CHAIN_ID, XAUT0_ADDRESS),
    name: "Tether Gold",
    symbol: "XAUt0",
    role: "asset",
    instrument: "token",
    network: ids.evmChain(MAINNET_CHAIN_ID),
    art: spotArtKey("XAUt0"),
  },
];

const FX_PAIRS = [
  { base: "EUR", name: "Euro / US Dollar", art: "fx-eur-usd" },
  { base: "GBP", name: "British Pound / US Dollar", art: "fx-gbp-usd" },
  { base: "JPY", name: "Japanese Yen / US Dollar", art: "fx-jpy-usd" },
  { base: "CHF", name: "Swiss Franc / US Dollar", art: "fx-chf-usd" },
  { base: "CAD", name: "Canadian Dollar / US Dollar", art: "fx-cad-usd" },
] as const;

const fxRows = (): Entity[] =>
  FX_PAIRS.map((p) => ({
    id: ids.fxPair(p.base, "USD"),
    name: p.name,
    symbol: `${p.base}/USD`,
    role: "asset",
    instrument: "fx-pair",
    venue: ids.venue("senryo"),
    art: p.art,
  }));

const org = (id: string, name: string, role: Entity["role"], art?: string, gap?: string): Entity => ({
  id,
  name,
  role,
  instrument: "none",
  ...(art ? { art } : {}),
  ...(gap ? { gap } : {}),
});

const orgRows = (): Entity[] => [
  org(ids.brand("senryo"), "Senryo", "brand", "senryo-seal"),
  org(ids.venue("senryo"), "Senryo", "venue", "senryo-venue"),
  org(ids.venue("perpl"), "Perpl", "venue", "perpl"),
  org(ids.provider("chainlink"), "Chainlink", "oracle", "chainlink"),
  org(ids.provider("envio"), "Envio", "indexer", "envio"),
  org(ids.provider("db-ip"), "DB-IP", "data-provider", "db-ip"),
  org(ids.provider("aurora"), "Aurora", "route-provider", "aurora"),
  org(ids.provider("uniswap"), "Uniswap", "route-provider", "uniswap"),
  // Any-asset routes (D-239): the swap aggregators and bridges a quote can take.
  org(ids.provider("monorail"), "Monorail", "route-provider", "monorail"),
  org(ids.provider("kyberswap"), "KyberSwap", "route-provider", "kyberswap"),
  org(ids.provider("relay"), "Relay", "route-provider", "relay"),
  org(ids.provider("across"), "Across", "route-provider", "across"),
  org(ids.provider("lifi"), "LI.FI", "route-provider", "lifi"),
  org(ids.provider("cctp"), "Circle CCTP", "route-provider", "circle-cctp"),
  org(ids.provider("ramp"), "Ramp Network", "route-provider", "ramp"),
  // Card wallets (E5): named on the Add to Wallet row.
  org(ids.provider("apple-wallet"), "Apple Wallet", "wallet", "apple-pay"),
  org(ids.provider("google-wallet"), "Google Wallet", "wallet", "google-pay"),
  org(ids.provider("passkey"), "Passkey", "auth-provider", "passkey"),
  org(ids.exchange("coinbase"), "Coinbase", "exchange", "coinbase"),
  org(ids.exchange("binance"), "Binance", "exchange", "binance"),
  org(ids.exchange("kraken"), "Kraken", "exchange", "kraken"),
];

/**
 * Underlyings by ticker: the calculated equity feeds (`CALCULATED_EQUITIES`) and NVDA's arriving market. A company
 * shows its own mark, a fund its issuer's brand (SPDR, Invesco, iShares) — never the xStocks wrapper's art, whatever
 * the feed prices. Sources and the researched dead ends: scripts/catalog.ts.
 */
const EQUITIES: Readonly<Record<string, { name: string; art?: string; gap?: string }>> = {
  SPY: {
    name: "SPDR S&P 500 ETF",
    gap: "SPDR (a trademark of Standard & Poor's Financial Services LLC, licensed to State Street) has no file under a usable grant: State Street's ETF sites (us, uk, au, ie) and the SPY page serve only the State Street Investment Management logo, Commons and Wikidata hold no SPDR mark, and Brandfetch forbids programmatic download (researched 1 Oct 2026)",
  },
  QQQ: {
    name: "Invesco QQQ",
    gap: "Invesco's only public vector is its site logo (invesco.com/etc.clientlibs/invesco/clientlib-global/clientlib/resources/images/logo-new.svg), and its Terms of Use forbid it: \"Without Invesco's express written permission, copy, modify, or display Invesco's name or logo\"; Wikipedia holds the logo as non-free fair use, Commons and Wikidata have none, and no press kit is public (researched 1 Oct 2026)",
  },
  NVDA: { name: "Nvidia", art: "nvidia" },
  TSLA: { name: "Tesla", art: "tesla" },
  SPCX: { name: "SpaceX", art: "spacex" },
  EWY: { name: "iShares MSCI South Korea ETF", art: "ishares" },
};

const equityRows = (): Entity[] =>
  Object.entries(EQUITIES).map(([ticker, e]) => ({
    id: ids.equity(ticker),
    name: e.name,
    symbol: ticker,
    role: "asset",
    instrument: "equity",
    ...(e.art ? { art: e.art } : { gap: e.gap ?? "artwork not acquired yet" }),
  }));

/**
 * Crude oil (`UNPRICED_INSTRUMENTS`, no feed on Monad yet): a commodity no owner's mark identifies, so a neutral glyph
 * (Material Symbols `oil_barrel`). Keyed `ids.equity` like the other arriving rows until it has a venue market id.
 */
const commodityRows = (): Entity[] => [
  {
    id: ids.equity("OIL"),
    name: "Crude oil (WTI / Brent)",
    symbol: "OIL",
    role: "asset",
    instrument: "commodity",
    art: "oil-barrel",
  },
];

export const ENTITIES: readonly Entity[] = [
  ...monadRows(),
  ...spotRows(),
  ...ownedRows(),
  ...perplRows(),
  ...externalRows(),
  ...fxRows(),
  ...orgRows(),
  ...equityRows(),
  ...commodityRows(),
];
