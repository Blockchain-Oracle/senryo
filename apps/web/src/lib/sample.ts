/**
 * PREVIEW DATA — the sample values left on the desk after S11b slice 1 connected markets, candles, the ticket's
 * preview and the account (portfolio, positions, watch). What remains feeds the Card and Fund screens and the card
 * authorizations, each of which shows a "Preview data" badge saying what it waits for.
 * Money is integer base units: usd6 (6 decimals) and bps.
 */
import { ROUTE_CHAIN_ID, routeAssetId } from "@senryo/identity";

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

/** `entity` is the canonical network id whose real mark badges each token and labels the network chip (S1b.4/S1b.6). */
export const SWAP_CHAINS = [
  { id: "base", name: "Base", shortName: "BASE", entity: ROUTE_CHAIN_ID.base },
  { id: "ethereum", name: "Ethereum", shortName: "ETH", entity: ROUTE_CHAIN_ID.ethereum },
  { id: "solana", name: "Solana", shortName: "SOL", entity: ROUTE_CHAIN_ID.solana },
  { id: "monad", name: "Monad", shortName: "MON", entity: ROUTE_CHAIN_ID.monad },
] as const;

export const SWAP_TOKENS = [
  {
    id: "base-usdc",
    chainId: "base",
    symbol: "USDC",
    name: "USD Coin",
    balance6: 2_400_000_000n,
    usd6: 1_000_000n,
    entity: routeAssetId("USDC", "base"),
  },
  {
    id: "eth-eth",
    chainId: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    balance6: 740_000n,
    usd6: 3_412_800_000n,
    entity: routeAssetId("ETH", "ethereum"),
  },
  {
    id: "sol-usdc",
    chainId: "solana",
    symbol: "USDC",
    name: "USD Coin",
    balance6: 860_150_000n,
    usd6: 1_000_000n,
    entity: routeAssetId("USDC", "solana"),
  },
  {
    id: "mon-ausd",
    chainId: "monad",
    symbol: "AUSD",
    name: "Agora USD · Free to trade",
    balance6: 7_210_400_000n,
    usd6: 1_000_000n,
    entity: routeAssetId("AUSD", "monad"),
  },
] as const;

export const SWAP_QUOTE = { fee6: 420_000n, slippageBps: 50n, eta: "≈ 24s" } as const;
