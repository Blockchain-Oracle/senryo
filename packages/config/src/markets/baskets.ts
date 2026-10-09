/**
 * Baskets (D-286): several listed markets of one source in points, 1,000 at their members' prices of one instant; σ
 * measured on the basket's own 1-minute index (×1.5). Pyth baskets price at 2026-10-09T14:00:00Z; Big tech at RedStone's
 * signed medians of 16:05:20Z (its members are RedStone feeds, so it is a RedStone basket).
 */
import { CADENCES_SEC } from "../cadences.ts";
import type { MarketSpec } from "../catalog.ts";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "../networks.ts";

export const PYTH_BASKETS: readonly MarketSpec[] = [
  {
    symbol: "MAJORS",
    name: "Crypto majors",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0x4e3e3c889b6c0c7d808f86efc9bad05c5a47cd1f10fe97967a80194302a2a83c",
      members: [
        { symbol: "BTC", weightBps: 3334, baseE8: 8_255_901_409_615n },
        { symbol: "ETH", weightBps: 3333, baseE8: 248_247_898_562n },
        { symbol: "SOL", weightBps: 3333, baseE8: 10_952_339_683n },
      ],
    },
    annualVol: 0.61,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "ALTS",
    name: "Alt coins",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0x8d72fb569fec73eed386cde5bf50b36da75cd28f167067da8ec09b8ce6c57e01",
      members: [
        { symbol: "DOGE", weightBps: 2500, baseE8: 8_440_963n },
        { symbol: "XRP", weightBps: 2500, baseE8: 137_902_450n },
        { symbol: "BNB", weightBps: 2500, baseE8: 73_843_159_515n },
        { symbol: "HYPE", weightBps: 2500, baseE8: 8_500_953_452n },
      ],
    },
    annualVol: 0.7,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "METALS",
    name: "Metals",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0xac73fa5dd455b02b64be95124bb0fb1ce639e7c7301a37838166aa1432864c30",
      members: [
        { symbol: "XAU", weightBps: 5000, baseE8: 419_035_200_000n },
        { symbol: "XAG", weightBps: 5000, baseE8: 6_105_866_000n },
      ],
    },
    annualVol: 0.45,
    cadences: CADENCES_SEC,
    calendarId: 2,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
];

export const REDSTONE_BASKETS: readonly MarketSpec[] = [
  {
    symbol: "TECH",
    name: "Big tech",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0xc10ae97914b1a77d97c30fafd6254032b768567ca82a379b8b25f397e909f2ef",
      members: [
        { symbol: "AAPL", weightBps: 1667, baseE8: 33_439_488_101n },
        { symbol: "MSFT", weightBps: 1667, baseE8: 53_531_286_532n },
        { symbol: "NVDA", weightBps: 1667, baseE8: 22_957_970_875n },
        { symbol: "GOOGL", weightBps: 1667, baseE8: 35_393_231_004n },
        { symbol: "AMZN", weightBps: 1666, baseE8: 26_128_203_535n },
        { symbol: "META", weightBps: 1666, baseE8: 72_476_853_483n },
      ],
    },
    annualVol: 0.41,
    cadences: CADENCES_SEC,
    calendarId: 1,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
];
