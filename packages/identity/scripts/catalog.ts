/**
 * The fetch catalog: every mark that is acquired programmatically, as data. `fetch-marks.ts` downloads each entry from
 * its public source, pins the bytes (sha256) and writes the artwork records to `src/art/generated/fetched.ts`.
 * Adding a mark is one entry here plus `pnpm --filter @senryo/identity run fetch` — never a manual download.
 *
 * Sources (researched 2026-10-01; docs read through Context7):
 * - web3icons (github.com/0xa3k5/web3icons, MIT): 1,800+ tokens, 250 networks, 30 exchanges, each as `branded`
 *   (colour mark), `mono` (white silhouette) and `background` (mark on its brand colour, full-bleed square).
 * - Hyperliquid's app icon per listed coin (app.hyperliquid.xyz/coins/<COIN>.svg): the venue's own vector for assets
 *   too new for the libraries (Lighter, Venice, Pump).
 * - Simple Icons (github.com/simple-icons/simple-icons, CC0-1.0): one-path company marks plus the brand hex, for the
 *   underlying companies of equity markets (Nvidia, Tesla, SpaceX).
 * - Monad's token list (github.com/monad-crypto/token-list, pinned by commit in `MONAD_TOKEN_LIST`): the logo each
 *   issuer submitted with its token (`mainnet/<SYMBOL>/logo.svg|png`), for the J11 spot tokens (`SPOT_TOKENS`, itself
 *   generated from that list). Native MON keeps Monad's own first-party mark.
 * - Wikimedia Commons (commons.wikimedia.org, MediaWiki API `prop=imageinfo&iiprop=url|sha1|extmetadata`): a file whose
 *   page records it public domain or CC0 (a {{PD-textlogo}} wordmark with {{Trademarked}}), pinned by its version's
 *   SHA-1, with the page's licence fields read into the record — for fund brands no icon library carries (iShares).
 * - Google's Material Symbols (github.com/google/material-design-icons, Apache-2.0, pinned by `MATERIAL_COMMIT`, the
 *   passkey glyph's pin): neutral glyphs for an instrument no owner's mark identifies (crude oil: `oil_barrel`, a drum
 *   with an oil drop, where Lucide's and Tabler's `barrel` read as a wooden cask).
 * Researched and not usable (1 Oct 2026), so SPY and QQQ are recorded gaps in src/entities.ts: SPDR and Invesco have
 * no Simple Icons or Iconify entry (every collection searched), no Commons file and no Wikidata logo (P154); Brandfetch
 * forbids programmatic download ("Programmatic access to logo images is not permitted"); nvstly/icons has no licence
 * and ships recoloured redraws; logo aggregators (worldvectorlogo, seeklogo, companieslogo) are uploads with no
 * owner's grant. Never the xStocks wrapper's art for an equity feed.
 */
import { SPOT_TOKENS } from "@senryo/config";
import { spotArtKey } from "../src/ids.ts";

/** web3icons variant → ours: `background` is clipped to a disc, `mono` also yields the derived dark-ink silhouette. */
export type Web3IconsTake = "disc" | "symbol" | "mono";

export type FetchSpec =
  | { from: "web3icons"; group: "tokens" | "networks" | "exchanges"; name: string; take: readonly Web3IconsTake[] }
  | { from: "hyperliquid"; coin: string }
  | { from: "simple-icons"; slug: string }
  | { from: "monad-token-list"; dir: string; file: string; symbol: string }
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
  { key: "tron", owner: "TRON DAO", spec: { from: "web3icons", group: "networks", name: "tron", take: ALL } },
  { key: "polygon", owner: "Polygon Labs", spec: { from: "web3icons", group: "networks", name: "polygon", take: ALL } },
  { key: "lighter", owner: "Lighter", spec: { from: "hyperliquid", coin: "LIT" } },
  { key: "venice", owner: "Venice", spec: { from: "hyperliquid", coin: "VVV" } },
  { key: "pump", owner: "pump.fun", spec: { from: "hyperliquid", coin: "PUMP" } },
  { key: "nvidia", owner: "NVIDIA Corporation", spec: { from: "simple-icons", slug: "nvidia" } },
  { key: "tesla", owner: "Tesla, Inc.", spec: { from: "simple-icons", slug: "tesla" } },
  {
    key: "spacex",
    owner: "Space Exploration Technologies Corp. (SpaceX)",
    spec: { from: "simple-icons", slug: "spacex" },
  },
  {
    key: "ishares",
    owner: "BlackRock, Inc. (iShares)",
    spec: {
      from: "wikimedia-commons",
      file: "Logo-ishares 2019.svg",
      sha1: "c88e0c781deb3fb5d02d865e20341caba6cee26a",
    },
  },
  {
    key: "oil-barrel",
    owner: "Google — Material Symbols (github.com/google/material-design-icons)",
    spec: { from: "material-symbols", name: "oil_barrel", style: "rounded", filled: true },
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

/** Every listed spot token except native MON, keyed by its token-list folder. */
const SPOT_LOGOS: readonly CatalogEntry[] = SPOT_TOKENS.filter((t) => !t.native).map((t) => ({
  key: spotArtKey(t.list.dir),
  owner: `${t.name} (${t.symbol}) — its issuer's token art, as submitted to Monad's token list`,
  spec: { from: "monad-token-list", dir: t.list.dir, file: t.list.logo, symbol: t.symbol },
}));

/**
 * Owned assets beyond the J11 spot list (D-248): Tether Gold's omnichain XAUt0 on Monad — the token a user owns when
 * they buy real gold (the XAU perp keeps Senryo's own koban art, never this mark: LG19/LG38).
 */
const OWNED_LOGOS: readonly CatalogEntry[] = [
  {
    key: spotArtKey("XAUt0"),
    owner: "Tether Gold (XAUt0) — its issuer's token art, as submitted to Monad's token list",
    spec: { from: "monad-token-list", dir: "XAUt0", file: "logo.svg", symbol: "XAUt0" },
  },
];

export const CATALOG: readonly CatalogEntry[] = [...STANDALONE, ...SUPPLEMENTS, ...SPOT_LOGOS, ...OWNED_LOGOS];
