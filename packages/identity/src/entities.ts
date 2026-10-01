/**
 * Every known entity, keyed canonically (./ids.ts), bound to one artwork record (./art) or to a recorded gap. Label,
 * symbol, role, network/venue and artwork live on the same row, so a ticker can never borrow another entity's mark.
 * Practice (testnet) rows carry the real identity and say `practice: true`; the surface names the mode.
 */
import { ENGINE_MARKETS, MAINNET_CHAIN_ID, MAINNET_EXTERNAL, TESTNET_CHAIN_ID } from "@senryo/config";
import { EXTERNAL_CHAIN_IDS, PERPL_MARKETS, PRACTICE_TOKENS, USDC_ELSEWHERE } from "./constants.ts";
import { CAIP2, ids } from "./ids.ts";
import type { Entity } from "./types.ts";

const MONAD_NETWORKS = [
  { chainId: MAINNET_CHAIN_ID, practice: false },
  { chainId: TESTNET_CHAIN_ID, practice: true },
] as const;

/** Our engine's commodities → their original art (never an issuer's token art: XAU is not Tether Gold). */
const METAL_ART = { XAU: "xau-koban", XAG: "xag-chogin" } as const;

/** Crypto assets by ticker: display name and artwork key (undefined = first-party art not on file, see `gap`). */
const CRYPTO: Readonly<Record<string, { name: string; art?: string; gap?: string }>> = {
  BTC: { name: "Bitcoin", art: "bitcoin" },
  ETH: { name: "Ether", art: "ethereum" },
  SOL: { name: "Solana", art: "solana" },
  MON: { name: "Monad", art: "monad" },
  HYPE: { name: "Hyperliquid", art: "hyperliquid" },
  ZEC: { name: "Zcash", art: "zcash" },
  LIT: { name: "Lighter", gap: "Lighter first-party artwork not acquired yet" },
  VVV: { name: "Venice", gap: "Venice first-party artwork not acquired yet" },
  PUMP: { name: "Pump", gap: "pump.fun first-party artwork not acquired yet" },
  NEAR: { name: "NEAR", gap: "NEAR Foundation first-party artwork not acquired yet" },
};

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
    const venue = {
      network: chain,
      venue: ids.venue("senryo"),
      instrument: "commodity" as const,
      role: "asset" as const,
    };
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
        art: METAL_ART[m.symbol],
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
        name: asset?.name ?? symbol,
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
  const { ethereum, base, arbitrum } = EXTERNAL_CHAIN_IDS;
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
  org(
    ids.provider("passkey"),
    "Passkey",
    "auth-provider",
    undefined,
    "FIDO passkey icon is behind FIDO Alliance's download form + usage agreement (fidoalliance.org/passkey-download/); " +
      "submitting it is the user's [OK?]",
  ),
  org(ids.exchange("coinbase"), "Coinbase", "exchange", "coinbase"),
  org(ids.exchange("binance"), "Binance", "exchange", "binance"),
  org(ids.exchange("kraken"), "Kraken", "exchange", "kraken"),
  {
    ...org(ids.equity("NVDA"), "Nvidia", "asset", undefined, "NVIDIA press-kit artwork not acquired yet"),
    symbol: "NVDA",
    instrument: "equity",
  },
];

export const ENTITIES: readonly Entity[] = [
  ...monadRows(),
  ...perplRows(),
  ...externalRows(),
  ...fxRows(),
  ...orgRows(),
];
