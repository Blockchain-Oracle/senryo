/**
 * The fetch catalog: every mark that is acquired programmatically, as data. `fetch-marks.ts` downloads each entry from
 * its public source, pins the bytes (sha256) and writes the artwork records to `src/art/generated/fetched.ts`.
 * Adding a mark is one entry here plus `pnpm --filter @senryo/identity fetch` — never a manual download.
 *
 * Sources (researched 2026-10-01; docs read through Context7):
 * - web3icons (github.com/0xa3k5/web3icons, MIT): 1,800+ tokens, 250 networks, 30 exchanges, each as `branded`
 *   (colour mark), `mono` (white silhouette) and `background` (mark on its brand colour, full-bleed square).
 * - Hyperliquid's app icon per listed coin (app.hyperliquid.xyz/coins/<COIN>.svg): the venue's own vector for assets
 *   too new for the libraries (Lighter, Venice, Pump).
 * - Simple Icons (github.com/simple-icons/simple-icons, CC0-1.0): one-path company marks plus the brand hex, for the
 *   underlying companies of equity markets.
 */

/** web3icons variant → ours: `background` is clipped to a disc, `mono` also yields the derived dark-ink silhouette. */
export type Web3IconsTake = "disc" | "symbol" | "mono";

export type FetchSpec =
  | { from: "web3icons"; group: "tokens" | "networks" | "exchanges"; name: string; take: readonly Web3IconsTake[] }
  | { from: "hyperliquid"; coin: string }
  | { from: "simple-icons"; slug: string };

export interface CatalogEntry {
  /** Artwork key (`Entity.art`, or the `supplement` of a first-party record when prefixed `lib-`). */
  key: string;
  /** Who owns the mark (not who hosts the file). */
  owner: string;
  spec: FetchSpec;
}

const ALL: readonly Web3IconsTake[] = ["disc", "symbol", "mono"];
const MONO: readonly Web3IconsTake[] = ["mono"];

/** Marks with no first-party record on file: the fetched record is the entity's artwork. */
const STANDALONE: readonly CatalogEntry[] = [
  { key: "near", owner: "NEAR Foundation", spec: { from: "web3icons", group: "tokens", name: "NEAR", take: ALL } },
  { key: "bnb", owner: "BNB Chain", spec: { from: "web3icons", group: "tokens", name: "BNB", take: ALL } },
  { key: "tron", owner: "TRON DAO", spec: { from: "web3icons", group: "networks", name: "tron", take: ALL } },
  { key: "polygon", owner: "Polygon Labs", spec: { from: "web3icons", group: "networks", name: "polygon", take: ALL } },
  { key: "lighter", owner: "Lighter", spec: { from: "hyperliquid", coin: "LIT" } },
  { key: "venice", owner: "Venice", spec: { from: "hyperliquid", coin: "VVV" } },
  { key: "pump", owner: "pump.fun", spec: { from: "hyperliquid", coin: "PUMP" } },
  { key: "nvidia", owner: "NVIDIA Corporation", spec: { from: "simple-icons", slug: "nvidia" } },
];

/**
 * Variants an owner doesn't publish (mostly the mono silhouette the network picker uses, study 08 §1), filled from the
 * library. The first-party record names the entry as its `supplement`; its own files always win.
 */
const SUPPLEMENTS: readonly CatalogEntry[] = [
  {
    key: "lib-monad",
    owner: "Monad Foundation",
    spec: { from: "web3icons", group: "networks", name: "monad", take: MONO },
  },
  {
    key: "lib-bitcoin",
    owner: "Bitcoin (public domain mark)",
    spec: { from: "web3icons", group: "tokens", name: "BTC", take: ["symbol", "mono"] },
  },
  {
    key: "lib-ethereum",
    owner: "ethereum.org",
    spec: { from: "web3icons", group: "networks", name: "ethereum", take: MONO },
  },
  {
    key: "lib-solana",
    owner: "Solana Foundation",
    spec: { from: "web3icons", group: "networks", name: "solana", take: MONO },
  },
  {
    key: "lib-usdc",
    owner: "Circle Internet Financial",
    spec: { from: "web3icons", group: "tokens", name: "USDC", take: ["symbol", "mono"] },
  },
  {
    key: "lib-aurora",
    owner: "Aurora Labs",
    spec: { from: "web3icons", group: "networks", name: "aurora", take: MONO },
  },
  {
    key: "lib-coinbase",
    owner: "Coinbase, Inc.",
    spec: { from: "web3icons", group: "exchanges", name: "coinbase", take: ["symbol", "mono"] },
  },
  {
    key: "lib-binance",
    owner: "Binance",
    spec: { from: "web3icons", group: "exchanges", name: "binance", take: ["disc", "mono"] },
  },
  {
    key: "lib-kraken",
    owner: "Payward, Inc. (Kraken)",
    spec: { from: "web3icons", group: "exchanges", name: "kraken", take: MONO },
  },
];

export const CATALOG: readonly CatalogEntry[] = [...STANDALONE, ...SUPPLEMENTS];
