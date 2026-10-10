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
  /**
   * A mark served by its owner's own site (no library carries it), pinned by sha256 so a silent change fails; `basis`
   * records the owner's own words that allow the use (a brand kit's scope), quoted into the record.
   */
  | { from: "first-party"; url: string; page: string; sha256: string; basis?: string }
  /** LI.FI's open icon set (lifinance/types, Apache-2.0, pinned by commit): the bridges and aggregators it routes. */
  /**
   * `file` is the title without "File:"; `sha1` (Commons' own hash of the version) pins one upload. `clear` names inks
   * the file paints as a background plate (Microsoft's grey square), drawn as nothing in ours; `as: "wordmark"` takes a
   * wordmark (ESPN's) as the entity's wordmark rather than its symbol.
   */
  | { from: "wikimedia-commons"; file: string; sha1: string; clear?: readonly string[]; as?: "wordmark" }
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
  { key: "link", owner: "Chainlink Labs", spec: { from: "web3icons", group: "tokens", name: "LINK", take: ALL } },
  { key: "sui", owner: "Sui Foundation", spec: { from: "web3icons", group: "tokens", name: "SUI", take: ALL } },
  { key: "ton", owner: "TON Foundation", spec: { from: "web3icons", group: "tokens", name: "TON", take: ALL } },
  { key: "ada", owner: "Cardano Foundation", spec: { from: "web3icons", group: "tokens", name: "ADA", take: ALL } },
  { key: "ltc", owner: "Litecoin Foundation", spec: { from: "web3icons", group: "tokens", name: "LTC", take: ALL } },
  {
    key: "dot",
    owner: "Web3 Foundation (Polkadot)",
    spec: { from: "web3icons", group: "tokens", name: "DOT", take: ALL },
  },
  { key: "aave", owner: "Aave Companies", spec: { from: "web3icons", group: "tokens", name: "AAVE", take: ALL } },
  { key: "uni", owner: "Uniswap Labs", spec: { from: "web3icons", group: "tokens", name: "UNI", take: ALL } },
  { key: "tron", owner: "TRON DAO", spec: { from: "web3icons", group: "networks", name: "tron", take: ALL } },
  { key: "polygon", owner: "Polygon Labs", spec: { from: "web3icons", group: "networks", name: "polygon", take: ALL } },
  {
    key: "optimism",
    owner: "Optimism Foundation",
    spec: { from: "web3icons", group: "networks", name: "optimism", take: ALL },
  },
  { key: "avalanche", owner: "Ava Labs", spec: { from: "web3icons", group: "networks", name: "avalanche", take: ALL } },
  // The price oracle behind most markets (R2.6): its token mark, as the library draws it.
  {
    key: "pyth",
    owner: "Pyth Data Association",
    spec: { from: "web3icons", group: "tokens", name: "PYTH", take: ALL },
  },
  // The leagues events are about (R2.6). The NFL is not in Simple Icons (see src/entities.ts).
  { key: "nhl", owner: "National Hockey League", spec: { from: "simple-icons", slug: "nhl" } },
  { key: "mlb", owner: "Major League Baseball", spec: { from: "simple-icons", slug: "mlb" } },
  {
    key: "premier-league",
    owner: "The Football Association Premier League Limited",
    spec: { from: "simple-icons", slug: "premierleague" },
  },
  // Public domain on Commons (R2.6), pinned by version sha1: Microsoft's four squares (its grey plate cleared for the
  // symbol), Amazon's "a" and smile, ESPN's wordmark (an events data source).
  {
    key: "microsoft",
    owner: "Microsoft Corporation",
    spec: {
      from: "wikimedia-commons",
      file: "Microsoft logo.svg",
      sha1: "5b170117926ae5a5e451aa24676b5a124c2fa122",
      clear: ["#f3f3f3"],
    },
  },
  {
    key: "amazon",
    owner: "Amazon.com, Inc.",
    spec: { from: "wikimedia-commons", file: "Amazon icon.svg", sha1: "8fff4ec727ab9280d2c966528fd1d3b2d17fcbdd" },
  },
  {
    key: "espn",
    owner: "ESPN, Inc.",
    spec: {
      from: "wikimedia-commons",
      file: "ESPN wordmark.svg",
      sha1: "e1ac134512cbc4f1257612ebda9ec74a686d5b2b",
      as: "wordmark",
    },
  },
  {
    // The second price oracle (D-284), from its own brand kit (R2.6; researched 10 Oct 2026).
    key: "redstone",
    owner: "RedStone Oracles",
    spec: {
      from: "first-party",
      url: "https://www.redstone.finance/images/RedStoneLogoSymbolRed.svg",
      page: "https://www.redstone.finance/brand-kit/",
      sha256: "06a689c9e0b3d02d6265520096c1e33deabd2b594528a4ccaa7faafbc5e2122a",
      basis:
        'RedStone publishes this symbol in its brand kit, described as "Official RedStone brand assets — logos, … and usage rules for press, partners, and integrations"; Senryo integrates RedStone as a price source and names it beside its name. The kit\'s usage-rules PDF (Google Drive, over 10 MB) was not read; its rules govern if they differ.',
    },
  },
  { key: "nvidia", owner: "NVIDIA Corporation", spec: { from: "simple-icons", slug: "nvidia" } },
  { key: "tesla", owner: "Tesla, Inc.", spec: { from: "simple-icons", slug: "tesla" } },
  { key: "apple", owner: "Apple Inc.", spec: { from: "simple-icons", slug: "apple" } },
  { key: "meta", owner: "Meta Platforms, Inc.", spec: { from: "simple-icons", slug: "meta" } },
  { key: "google", owner: "Google LLC (Alphabet)", spec: { from: "simple-icons", slug: "google" } },
  { key: "palantir", owner: "Palantir Technologies Inc.", spec: { from: "simple-icons", slug: "palantir" } },
  { key: "amd", owner: "Advanced Micro Devices, Inc.", spec: { from: "simple-icons", slug: "amd" } },
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
