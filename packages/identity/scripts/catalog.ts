/**
 * The fetch catalog: every mark that is acquired programmatically, as data. `fetch-marks.ts` downloads each entry from
 * its public source, pins the bytes (sha256) and writes the artwork records to `src/art/generated/fetched.ts`.
 * Adding a mark is one entry here plus `pnpm --filter @senryo/identity run fetch` — never a manual download.
 *
 * Sources (researched 2026-10-01; docs read through Context7):
 * - web3icons (github.com/0xa3k5/web3icons, MIT): 1,800+ tokens, 250 networks, 30 exchanges, each as `branded`
 *   (colour mark), `mono` (white silhouette) and `background` (mark on its brand colour, full-bleed square).
 * - Simple Icons (github.com/simple-icons/simple-icons, CC0-1.0): one-path company marks plus the brand hex, for the
 *   underlying companies of equity markets (Nvidia, Tesla).
 * - Wikimedia Commons (commons.wikimedia.org, MediaWiki API `prop=imageinfo&iiprop=url|sha1|extmetadata`): a file whose
 *   page records it public domain or CC0 (a {{PD-textlogo}} wordmark with {{Trademarked}}), pinned by its version's
 *   SHA-1, with the page's licence fields read into the record — for fund brands no icon library carries (none on file since the D-256 pivot).
 * - Google's Material Symbols (github.com/google/material-design-icons, Apache-2.0, pinned by `MATERIAL_COMMIT`, the
 *   passkey glyph's pin): neutral glyphs for an instrument no owner's mark identifies (Practice's Test USD).
 * Researched and not usable (1 Oct 2026), so SPY and QQQ are recorded gaps in src/entities.ts: SPDR and Invesco have
 * no Simple Icons or Iconify entry (every collection searched), no Commons file and no Wikidata logo (P154); Brandfetch
 * forbids programmatic download ("Programmatic access to logo images is not permitted"); nvstly/icons has no licence
 * and ships recoloured redraws; logo aggregators (worldvectorlogo, seeklogo, companieslogo) are uploads with no
 * owner's grant. Never the xStocks wrapper's art for an equity feed.
 */

/** web3icons variant → ours: `background` is clipped to a disc, `mono` also yields the derived dark-ink silhouette. */
export type Web3IconsTake = "disc" | "symbol" | "mono";

export type FetchSpec =
  | { from: "web3icons"; group: "tokens" | "networks" | "exchanges"; name: string; take: readonly Web3IconsTake[] }
  | { from: "simple-icons"; slug: string }
  /** A mark served by its owner's own site (no library carries it), pinned by sha256 so a silent change fails. */
  | { from: "first-party"; url: string; page: string; sha256: string }
  /** LI.FI's open icon set (lifinance/types, Apache-2.0, pinned by commit): the bridges and aggregators it routes. */
  /** `file` is the title without "File:"; `sha1` (Commons' own hash of the version) pins one upload. */
  | { from: "wikimedia-commons"; file: string; sha1: string }
  | { from: "material-symbols"; name: string; style: "outlined" | "rounded" | "sharp"; filled: boolean };

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
  { key: "doge", owner: "Dogecoin Foundation", spec: { from: "web3icons", group: "tokens", name: "DOGE", take: ALL } },
  { key: "xrp", owner: "XRP Ledger Foundation", spec: { from: "web3icons", group: "tokens", name: "XRP", take: ALL } },
  { key: "tron", owner: "TRON DAO", spec: { from: "web3icons", group: "networks", name: "tron", take: ALL } },
  { key: "polygon", owner: "Polygon Labs", spec: { from: "web3icons", group: "networks", name: "polygon", take: ALL } },
  {
    key: "optimism",
    owner: "Optimism Foundation",
    spec: { from: "web3icons", group: "networks", name: "optimism", take: ALL },
  },
  { key: "avalanche", owner: "Ava Labs", spec: { from: "web3icons", group: "networks", name: "avalanche", take: ALL } },
  { key: "nvidia", owner: "NVIDIA Corporation", spec: { from: "simple-icons", slug: "nvidia" } },
  { key: "tesla", owner: "Tesla, Inc.", spec: { from: "simple-icons", slug: "tesla" } },
  {
    // Baskets (D-286): several markets in points — no owner's mark exists, so a neutral glyph for "a stack of them".
    key: "basket",
    owner: "Google — Material Symbols (github.com/google/material-design-icons)",
    spec: { from: "material-symbols", name: "stacks", style: "rounded", filled: true },
  },
  {
    // Practice's dollar (D-258): ours, with no issuer — a neutral coin glyph, never USDC's mark.
    key: "test-usd",
    owner: "Google — Material Symbols (github.com/google/material-design-icons)",
    spec: { from: "material-symbols", name: "paid", style: "rounded", filled: true },
  },
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
