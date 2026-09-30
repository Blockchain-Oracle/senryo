/**
 * PREVIEW DATA — the single source of sample values for the S1 web shell.
 * Every screen that reads from here shows the "PREVIEW DATA" badge. Real data arrives in S6–S8
 * (account, buckets and positions from the chain + indexer; prices from Chainlink/Perpl).
 * Money is integer base units: usd6 (6 decimals) and bps. Chart series live in `sample-series.ts`.
 */

export const IS_PREVIEW_DATA = true;

export type MarketKind = "metal" | "crypto" | "equity" | "fx";
export type Venue = "SENRYO" | "PERPL";
export type Session = "OPEN" | "24/7" | "CLOSED" | "SOON";

export type SampleMarket = {
  symbol: string;
  name: string;
  kind: MarketKind;
  venue: Venue;
  price6: bigint;
  changeBps: bigint;
  session: Session;
  maxLev: number;
  /** Open interest (usd6) — sizes the heatmap tile. */
  oi6: bigint;
  fundingBps: bigint;
  /** Seconds since the oracle round that priced this market (D-020 honesty). */
  oracleAgeSec: number;
  seed: number;
};

export const MARKETS: readonly SampleMarket[] = [
  {
    symbol: "XAU",
    name: "Gold",
    kind: "metal",
    venue: "SENRYO",
    price6: 2_687_400_000n,
    changeBps: 82n,
    session: "OPEN",
    maxLev: 20,
    oi6: 18_400_000_000_000n,
    fundingBps: 4n,
    oracleAgeSec: 184,
    seed: 17,
  },
  {
    symbol: "XAG",
    name: "Silver",
    kind: "metal",
    venue: "SENRYO",
    price6: 31_420_000n,
    changeBps: 146n,
    session: "OPEN",
    maxLev: 20,
    oi6: 6_100_000_000_000n,
    fundingBps: 3n,
    oracleAgeSec: 212,
    seed: 23,
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    venue: "PERPL",
    price6: 64_210_500_000n,
    changeBps: 146n,
    session: "24/7",
    maxLev: 25,
    oi6: 12_800_000_000_000n,
    fundingBps: 8n,
    oracleAgeSec: 1,
    seed: 7,
  },
  {
    symbol: "ETH",
    name: "Ether",
    kind: "crypto",
    venue: "PERPL",
    price6: 3_412_800_000n,
    changeBps: 266n,
    session: "24/7",
    maxLev: 25,
    oi6: 9_300_000_000_000n,
    fundingBps: 6n,
    oracleAgeSec: 1,
    seed: 8,
  },
  {
    symbol: "MON",
    name: "Monad",
    kind: "crypto",
    venue: "PERPL",
    price6: 948_100n,
    changeBps: 612n,
    session: "24/7",
    maxLev: 10,
    oi6: 4_200_000_000_000n,
    fundingBps: 11n,
    oracleAgeSec: 1,
    seed: 9,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    kind: "equity",
    venue: "SENRYO",
    price6: 136_240_000n,
    changeBps: 382n,
    session: "SOON",
    maxLev: 10,
    oi6: 2_000_000_000_000n,
    fundingBps: 0n,
    oracleAgeSec: 0,
    seed: 2,
  },
  {
    symbol: "AAPL",
    name: "Apple",
    kind: "equity",
    venue: "SENRYO",
    price6: 212_330_000n,
    changeBps: -72n,
    session: "SOON",
    maxLev: 10,
    oi6: 1_800_000_000_000n,
    fundingBps: 0n,
    oracleAgeSec: 0,
    seed: 3,
  },
  {
    symbol: "EUR/USD",
    name: "Euro",
    kind: "fx",
    venue: "SENRYO",
    price6: 1_084_200n,
    changeBps: 11n,
    session: "SOON",
    maxLev: 50,
    oi6: 1_200_000_000_000n,
    fundingBps: 0n,
    oracleAgeSec: 0,
    seed: 5,
  },
];

export const DEFAULT_MARKET = "XAU";

export function findMarket(symbol: string): SampleMarket | undefined {
  const wanted = symbol.toUpperCase();
  return MARKETS.find((m) => m.symbol.replace("/", "") === wanted.replace("/", ""));
}

/** Route slugs for `/trade/[market]` (static export pre-renders each). */
export const MARKET_SLUGS = MARKETS.map((m) => m.symbol.replace("/", ""));

/** One balance, risk-accounted buckets (plan §2.4; D-010 adds "In Perpl", never counted in Free to spend). */
export const BALANCE = {
  total6: 12_480_520_000n,
  freeToTrade6: 7_210_400_000n,
  freeToSpend6: 3_120_120_000n,
  locked6: 2_150_000_000n,
  inPerpl6: 650_000_000n,
  pnl24h6: 184_220_000n,
  pnl24hBps: 150n,
} as const;

export type SamplePosition = {
  symbol: string;
  venue: Venue;
  side: "LONG" | "SHORT";
  lev: number;
  size6: bigint;
  entry6: bigint;
  liq6: bigint;
  pnl6: bigint;
  liqDistanceBps: bigint;
};

export const POSITIONS: readonly SamplePosition[] = [
  {
    symbol: "XAU",
    venue: "SENRYO",
    side: "LONG",
    lev: 5,
    size6: 1_500_000_000n,
    entry6: 2_651_200_000n,
    liq6: 2_140_100_000n,
    pnl6: 102_400_000n,
    liqDistanceBps: 2036n,
  },
  {
    symbol: "BTC",
    venue: "PERPL",
    side: "SHORT",
    lev: 3,
    size6: 650_000_000n,
    entry6: 65_110_000_000n,
    liq6: 85_420_000_000n,
    pnl6: 13_400_000n,
    liqDistanceBps: 3303n,
  },
];

export const TICKET = {
  symbol: "XAU",
  size6: 1_500_000_000n,
  feeBps: 2n,
  fee6: 1_500_000n,
  defaultLev: 5,
  maxLev: 20,
  /** Maintenance margin used for the preview liq estimate (display only; the risk mirror arrives in S3). */
  maintenanceBps: 9000n,
} as const;

export const EXECUTION_STEPS = [
  { id: "sig", label: "Face ID · passkey signed", meta: "0.4s" },
  { id: "risk", label: "Risk check · one vault", meta: "0.02s" },
  { id: "sent", label: "Sent to Monad · proposed", meta: "0.3s" },
  { id: "voted", label: "Voted · FILLED", meta: "0.4s" },
  { id: "final", label: "Finalized · SETTLED", meta: "…" },
] as const;

export const CARD = {
  holder: "PREVIEW · SENRYO",
  pan: "5412 7534 9921 4242",
  expiry: "09/29",
  cvv: "•••",
  spendLimit6: 1_000_000_000n,
  spendRemaining6: 841_000_000n,
  resetInSec: 17_940,
  label: "Sandbox card",
} as const;

export type SampleHold = { merchant: string; amount6: bigint; status: "HOLD" | "SETTLED"; when: string };

export const CARD_HOLDS: readonly SampleHold[] = [
  { merchant: "Blue Bottle Coffee", amount6: 6_400_000n, status: "HOLD", when: "Now" },
  { merchant: "Uber", amount6: 23_180_000n, status: "HOLD", when: "12 min" },
  { merchant: "Apple Store", amount6: 129_000_000n, status: "SETTLED", when: "Yesterday" },
];

/** Sample deposit address (not a real account). Real persistent addresses come from Aurora in S9. */
export const DEPOSIT_ADDRESS = "0x7a3F9c2E41b0D5e8A6f1c93B24dE70aF5b1C8e42";

export const SWAP_CHAINS = [
  { id: "base", name: "Base", shortName: "BASE", colorVar: "--chain-base" },
  { id: "ethereum", name: "Ethereum", shortName: "ETH", colorVar: "--chain-ethereum" },
  { id: "solana", name: "Solana", shortName: "SOL", colorVar: "--chain-solana" },
  { id: "monad", name: "Monad", shortName: "MON", colorVar: "--chain-monad" },
] as const;

export const SWAP_TOKENS = [
  {
    id: "base-usdc",
    chainId: "base",
    symbol: "USDC",
    name: "USD Coin",
    balance6: 2_400_000_000n,
    usd6: 1_000_000n,
    icon: "$",
  },
  {
    id: "eth-eth",
    chainId: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    balance6: 740_000n,
    usd6: 3_412_800_000n,
    icon: "Ξ",
  },
  {
    id: "sol-usdc",
    chainId: "solana",
    symbol: "USDC",
    name: "USD Coin",
    balance6: 860_150_000n,
    usd6: 1_000_000n,
    icon: "$",
  },
  {
    id: "mon-ausd",
    chainId: "monad",
    symbol: "AUSD",
    name: "Agora USD · Free to trade",
    balance6: 7_210_400_000n,
    usd6: 1_000_000n,
    icon: "A",
  },
] as const;

export const SWAP_QUOTE = { fee6: 420_000n, slippageBps: 50n, eta: "≈ 24s" } as const;

export const NETWORK = { name: "MONAD", mode: "PRACTICE", blockTime: "0.4s" } as const;
