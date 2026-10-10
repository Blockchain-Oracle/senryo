/**
 * Every known entity, keyed canonically (./ids.ts), bound to one artwork record (./art) or to a recorded gap. Label,
 * symbol, role, network/venue and artwork live on the same row, so a ticker can never borrow another entity's mark.
 * Practice (testnet) rows carry the real identity and say `practice: true`; the surface names the mode.
 * Prediction markets are keyed by catalogue symbol (`ids.market`, D-268); stock logos come through the scripted
 * pipeline (scripts/catalog.ts), never by hand.
 */
import { basketMembers, MAINNET_CHAIN_ID, MAINNET_USDC, MARKETS, TESTNET_CHAIN_ID } from "@senryo/config";
import { EXTERNAL_CHAIN_IDS, PRACTICE_DOLLAR, USDC_ELSEWHERE } from "./constants.ts";
import { CAIP2, ids } from "./ids.ts";
import { marketId } from "./lookup.ts";
import type { Entity } from "./types.ts";

const MONAD_NETWORKS = [
  { chainId: MAINNET_CHAIN_ID, practice: false },
  { chainId: TESTNET_CHAIN_ID, practice: true },
] as const;

/** Crypto price markets by ticker: artwork key (undefined = no artwork on file, see `gap`). */
const CRYPTO: Readonly<Record<string, { name: string; art?: string; gap?: string }>> = {
  BTC: { name: "Bitcoin", art: "bitcoin" },
  ETH: { name: "Ethereum", art: "ethereum" },
  SOL: { name: "Solana", art: "solana" },
  MON: { name: "Monad", art: "monad" },
  DOGE: { name: "Dogecoin", art: "doge" },
  XRP: { name: "XRP", art: "xrp" },
  BNB: { name: "BNB", art: "bnb" },
  HYPE: { name: "Hyperliquid", art: "hyperliquid" },
  AVAX: { name: "Avalanche", art: "avalanche" },
  LINK: { name: "Chainlink", art: "link" },
  SUI: { name: "Sui", art: "sui" },
  TON: { name: "Toncoin", art: "ton" },
  ADA: { name: "Cardano", art: "ada" },
  LTC: { name: "Litecoin", art: "ltc" },
  DOT: { name: "Polkadot", art: "dot" },
  NEAR: { name: "NEAR", art: "near" },
  AAVE: { name: "Aave", art: "aave" },
  UNI: { name: "Uniswap", art: "uni" },
};

/** Gold and silver priced as markets (original koban and chōgin art, never an issuer's token art). */
const COMMODITY_MARKETS = [
  { symbol: "XAU", name: "Gold", art: "xau-koban" },
  { symbol: "XAG", name: "Silver", art: "xag-chogin" },
] as const;

/**
 * Baskets of listed markets in points (D-286): the mark is the members' own marks overlapped (R2.6), so each basket
 * reads as what it holds; the neutral glyph stays for a basket whose members have no art.
 */
const BASKET_MARKETS = [
  { symbol: "MAJORS", name: "Crypto majors" },
  { symbol: "ALTS", name: "Alt coins" },
  { symbol: "METALS", name: "Metals" },
  { symbol: "TECH", name: "Big tech" },
] as const;

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
    const rows: Entity[] = [
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
    ];
    // Practice calls in Test USD (D-258), Real in Circle USDC.
    if (practice) {
      rows.push({
        id: ids.token(chainId, PRACTICE_DOLLAR),
        name: "Test USD",
        symbol: "tUSD",
        role: "asset",
        instrument: "stablecoin",
        network: chain,
        art: "test-usd",
        ...flag,
      });
    } else {
      rows.push({
        id: ids.token(chainId, MAINNET_USDC),
        name: "USD Coin",
        symbol: "USDC",
        role: "asset",
        instrument: "stablecoin",
        network: chain,
        art: "usdc",
      });
    }
    return rows;
  });
}

/** The prediction markets (crypto and gold); stocks are `equityRows`, FX `fxRows`. */
const marketRows = (): Entity[] => [
  ...Object.entries(CRYPTO).map(([symbol, c]) => ({
    id: ids.market(symbol),
    name: c.name,
    symbol,
    role: "asset" as const,
    instrument: "crypto" as const,
    ...(c.art ? { art: c.art } : { gap: c.gap ?? "artwork not acquired yet" }),
  })),
  ...COMMODITY_MARKETS.map((m) => ({
    id: ids.market(m.symbol),
    name: m.name,
    symbol: m.symbol,
    role: "asset" as const,
    instrument: "commodity" as const,
    art: m.art,
  })),
  ...BASKET_MARKETS.map((m) => ({
    id: ids.market(m.symbol),
    name: m.name,
    symbol: m.symbol,
    role: "asset" as const,
    instrument: "basket" as const,
    art: "basket",
    members: basketMembers(MARKETS.find((x) => x.symbol === m.symbol) as (typeof MARKETS)[number]).map(({ market }) =>
      marketId(market.symbol),
    ),
  })),
];

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
  org(ids.provider("pyth"), "Pyth", "oracle", "pyth"),
  org(ids.provider("redstone"), "RedStone", "oracle", "redstone"),
  // An events data source (D-296): one of the three committee readers.
  org(ids.provider("espn"), "ESPN", "data-provider", "espn"),
  org(
    ids.provider("thescore"),
    "theScore",
    "data-provider",
    undefined,
    'theScore (Score Media and Gaming, PENN Entertainment) publishes no brand kit and its Terms of Use say "You agree not to display or use in any manner any theScore Mark without theScore\'s prior written consent"; Commons holds only the old Score TV Network wordmark (researched 10 Oct 2026)',
  ),
  // The MON market's labelled second source on mainnet (D-258, S9).
  org(ids.provider("chainlink"), "Chainlink", "oracle", "chainlink"),
  org(ids.provider("envio"), "Envio", "indexer", "envio"),
  org(ids.provider("db-ip"), "DB-IP", "data-provider", "db-ip"),
  org(ids.provider("aurora"), "Aurora", "route-provider", "aurora"),
  org(ids.provider("passkey"), "Passkey", "auth-provider", "passkey"),
  org(ids.exchange("coinbase"), "Coinbase", "exchange", "coinbase"),
  org(ids.exchange("binance"), "Binance", "exchange", "binance"),
  org(ids.exchange("kraken"), "Kraken", "exchange", "kraken"),
  // The leagues events are about (R2.6; `LEAGUES` in packages/config/src/events.ts).
  org(ids.league("nhl"), "NHL", "league", "nhl"),
  org(ids.league("mlb"), "MLB", "league", "mlb"),
  org(ids.league("epl"), "Premier League", "league", "premier-league"),
  org(
    ids.league("nfl"),
    "NFL",
    "league",
    undefined,
    "The NFL shield is in no icon library (Simple Icons never carried it) and not on Commons; English Wikipedia's copy is fair-use/contested, and the NFL's terms say \"you shall not use any of our Trademarks without our express prior written permission\" (researched 10 Oct 2026)",
  ),
];

/**
 * Stocks and ETFs called on as price markets (Pyth equity feeds, regular hours, D-265). A company shows its own mark,
 * a fund its issuer's brand (SPDR, Invesco) — never a wrapper's art. Sources and the researched dead ends:
 * scripts/catalog.ts.
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
  AAPL: { name: "Apple", art: "apple" },
  MSFT: { name: "Microsoft", art: "microsoft" },
  META: { name: "Meta", art: "meta" },
  AMZN: { name: "Amazon", art: "amazon" },
  GOOGL: { name: "Alphabet", art: "google" },
  PLTR: { name: "Palantir", art: "palantir" },
  AMD: { name: "AMD", art: "amd" },
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

export const ENTITIES: readonly Entity[] = [
  ...monadRows(),
  ...marketRows(),
  ...externalRows(),
  ...fxRows(),
  ...orgRows(),
  ...equityRows(),
];
