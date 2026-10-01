/**
 * What every fetch source shares (./fetch-marks.ts and the per-source modules beside it): the record shape a source
 * returns, the guarded download helpers, and the colour tests that pick a variant's ground.
 */
import type { ArtFile, Derivation, MarkVariant, Provenance } from "../src/types.ts";

export const SOURCES = "packages/identity/sources";
export const DARK_INK = "#000000";
export const LIGHT_INK = "#FFFFFF";
const FETCH_TIMEOUT_MS = 30_000;
const HEX_RADIX = 16;
const HEX_CHANNEL_CHARS = 2;
const CHANNEL_MAX = 255;
/** Rec. 601 luma weights; a brand colour darker / lighter than these bounds needs the opposite ground. */
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;
const LUMA_NEEDS_LIGHT_GROUND = 0.2;
const LUMA_NEEDS_DARK_GROUND = 0.85;

export type Presentation = Pick<ArtFile, "insetPermille" | "surface" | "shape" | "crop">;

export interface Piece {
  variant: MarkVariant;
  /** File name inside sources/<key>/. */
  name: string;
  url: string;
  /** The file as delivered: SVG text, or PNG bytes where the owner ships raster only. */
  body: string | Buffer;
  present: Presentation;
  derived?: Derivation;
}

/** A text the licence asks to travel with the file (Apache-2.0 §4a), written beside it in sources/<key>/. */
export interface Notice {
  name: string;
  url: string;
  body: string;
}

export interface Fetched {
  provenance: Provenance;
  pageUrl: string;
  licence: string;
  usage: string;
  pieces: Piece[];
  notices?: Notice[];
}

export const pathOf = (key: string, name: string): string => `${SOURCES}/${key}/${name}`;

export async function fetched(url: string, headers?: Record<string, string>): Promise<Response> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...(headers ? { headers } : {}),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

export const get = async (url: string, headers?: Record<string, string>): Promise<string> =>
  (await fetched(url, headers)).text();

/** A delivered file must be a self-contained vector: no raster, no live text, nothing foreign. */
export async function getSvg(url: string, headers?: Record<string, string>): Promise<string> {
  const svg = await get(url, headers);
  if (!/<svg\b/.test(svg)) throw new Error(`${url}: not an SVG`);
  const bad = /<(image|text|foreignObject)\b/.exec(svg);
  if (bad) throw new Error(`${url}: contains <${bad[1]}> — pick another source for this mark`);
  return svg;
}

/**
 * The one paint a mono silhouette uses, as an attribute (`fill="#fff"`) or a style declaration (`fill:#000000`), so
 * recolouring it is a single literal substitution.
 */
export function soleInk(svg: string, label: string): string {
  const paints = [...svg.matchAll(/(?:fill|stroke|stop-color)(?:="([^"]+)"|:\s*([^;"}]+))/g)].map((m) =>
    (m[1] ?? m[2] ?? "").trim(),
  );
  const inks = [...new Set(paints.filter((p) => p !== "none"))];
  if (inks.length !== 1 || inks[0] === undefined)
    throw new Error(`${label}: expected one ink, found ${inks.join(", ")}`);
  return inks[0];
}

/** Which ground a flat colour (`RRGGBB`, with or without `#`) reads on. */
export function surfaceFor(hex: string): ArtFile["surface"] {
  const digits = hex.replace(/^#/, "");
  const channel = (index: number) =>
    Number.parseInt(digits.slice(index * HEX_CHANNEL_CHARS, (index + 1) * HEX_CHANNEL_CHARS), HEX_RADIX) / CHANNEL_MAX;
  const luma = LUMA_RED * channel(0) + LUMA_GREEN * channel(1) + LUMA_BLUE * channel(2);
  if (luma < LUMA_NEEDS_LIGHT_GROUND) return "light";
  return luma > LUMA_NEEDS_DARK_GROUND ? "dark" : "any";
}
