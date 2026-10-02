/**
 * The identity contract (reference study 08 "Asset-delivery contract", v2-plan W3). An entity is keyed by what it
 * actually is (chain + contract, venue + market id), never by a display ticker, and points at one artwork record that
 * carries its provenance. Plain data: no React, no platform code (the invariant `identity-provenance` imports it).
 */

/** What the mark identifies on a surface. Asset, network, venue and status stay separate roles (study 08 table). */
export type EntityRole =
  | "asset"
  | "network"
  | "venue"
  | "oracle"
  | "indexer"
  | "data-provider"
  | "route-provider"
  | "exchange"
  | "auth-provider"
  /** A phone wallet a card is added to (Apple Wallet, Google Wallet; flow book E5). */
  | "wallet"
  | "brand";

/** `token`: an ERC-20 held and traded spot on Monad (J11), whatever it tracks. */
export type InstrumentType =
  | "native-token"
  | "stablecoin"
  | "token"
  | "perp"
  | "commodity"
  | "fx-pair"
  | "equity"
  | "none";

/**
 * Artwork variants. `disc` is the contained asset presentation (market rows, pickers); `symbol` the uncontained mark;
 * `monoLight` a one-colour light-ink silhouette for dark grounds; `monoDark` a one-colour dark-ink silhouette for light
 * grounds; `wordmark` the name as drawn by its owner and `wordmarkLight` its light-ink version for dark grounds.
 * A variant that isn't on file is never synthesised at render time; one is derived (a recorded, reproducible recolour)
 * only where the owner's guidelines or licence allow that colourway (`ArtFile.derived`).
 */
export type MarkVariant = "disc" | "symbol" | "monoLight" | "monoDark" | "wordmark" | "wordmarkLight";

/** The ground a variant needs for contrast. `any` works on both themes. */
export type ContrastSurface = "any" | "dark" | "light";

export type ArtShape = "disc" | "tile" | "free";

/**
 * How the file came to exist: downloaded from the owner, public domain, authored by Senryo, fetched from an openly
 * licensed icon library (web3icons, Simple Icons, Material Symbols), or fetched from the venue that lists the instrument
 * (its own icon for that market). The last two, and public-domain files from Wikimedia Commons, are acquired by
 * `scripts/fetch-marks.ts` from `scripts/catalog.ts`, never by hand.
 */
export type Provenance = "first-party" | "public-domain" | "senryo-original" | "open-library" | "venue-metadata";

/**
 * A variant made from another registered file by an exact colour substitution, and only where the owner's own
 * guidelines (or the licence) allow that colourway. The derived bytes are reproducible: `deriveSvg(from, this)` must
 * equal the file on disk (codegen `--derive` writes it; invariant `identity-provenance` re-derives and compares).
 */
export interface Derivation {
  /** Repo-root-relative path of the registered source file. */
  from: string;
  /** Literal colour substitutions applied to the source text, source → derived (case-insensitive, e.g. "#70D44B"). */
  recolour: Readonly<Record<string, string>>;
  /** A fill set on the root `<svg>`, for shapes that carry no fill of their own (the implicit black). */
  rootFill?: string;
  /** The clause that permits the colourway, quoted with its URL. */
  basis: string;
}

export interface ArtFile {
  /** Repo-root-relative path of the file exactly as delivered (or authored): SVG, or PNG where the owner ships raster only. */
  path: string;
  /** Where this exact file was downloaded from (first-party) or `brand/…` for Senryo originals. */
  url: string;
  /** When the file came out of an archive (a brand-kit ZIP): the archive's URL and sha256 and the path inside it. */
  archive?: { url: string; sha256: string; path: string };
  /** The owner's minimum rendered size in px: the edge for marks, the width for wordmarks. */
  minPx?: number;
  /** sha256 of the file bytes at `path`; the invariant re-hashes it. */
  sha256: string;
  viewBox: string;
  /**
   * Built-in clear space around the mark, in thousandths of the viewBox edge (0 = the artwork touches its box).
   * Used to optically size an uncontained mark inside a plate.
   */
  insetPermille: number;
  surface: ContrastSurface;
  /**
   * The artwork's own silhouette: `disc` (a circle), `tile` (a rounded square) — both contained, so no plate is drawn
   * behind them — or `free` (an uncontained mark that gets a plate when a disc is asked for).
   */
  shape: ArtShape;
  /**
   * A one-colour glyph whose owner allows any single flat colour (the passkey icon): `EntityGlyph` draws it in the
   * caller's ink. Never set on a brand mark, which keeps its owner's colours.
   */
  tintable?: boolean;
  /** Set when this file was derived from another registered file (never for files kept as delivered). */
  derived?: Derivation;
  /**
   * The delivered file is a full-bleed square (an icon library's "background" variant); codegen clips it to the
   * inscribed circle. The file on disk stays byte-for-byte as delivered.
   */
  crop?: "disc";
}

export interface ArtSource {
  /** Stable key; also the generated component name stem. */
  key: string;
  owner: string;
  provenance: Provenance;
  /** The brand/press/source page the files were taken from. */
  pageUrl: string;
  /** The owner forbids placing the mark in a container (Uniswap): never draw a plate behind it. */
  noContainer?: boolean;
  /** Licence or usage terms, quoted or summarised with the URL they come from. */
  licence: string;
  /** ISO date (YYYY-MM-DD) the files were retrieved or authored. */
  retrieved: string;
  variants: Partial<Record<MarkVariant, ArtFile>>;
  /** Usage rules that bind the presentation (minimum size, contrast, "never as …"). */
  usage?: string;
  /** Other sources this artwork is composed from (e.g. public-domain flags inside an FX pair disc). */
  derivedFrom?: readonly string[];
  /**
   * Key of a fetched library record for the same mark. It fills only the variants this record has no file for (an
   * owner that publishes no mono silhouette); a variant on file here always wins.
   */
  supplement?: string;
}

export interface Entity {
  id: string;
  name: string;
  /** Ticker or short label shown next to the mark; the mark never replaces it. */
  symbol?: string;
  role: EntityRole;
  instrument: InstrumentType;
  /** The network entity this lives on (tokens, markets). */
  network?: string;
  /** The execution venue (markets). */
  venue?: string;
  /** Key into the artwork records, or undefined when the art is a recorded gap. */
  art?: string;
  /** Recorded reason when `art` is undefined: the entity is known, its first-party art is not on file yet. */
  gap?: string;
  /** Practice (testnet) stand-ins keep the real identity and say so. */
  practice?: boolean;
}
