/**
 * Lookups over the entity table and the drawing table, and the one place that decides how a mark is drawn (which
 * file, whether it needs a plate, which ground). Platform-free: the native and web `EntityMark` both call `planMark`.
 * It reads `DRAW` (generated from the artwork records by `drawOf`), never the records themselves: provenance stays out
 * of the apps (./provenance.ts has it).
 */
import { CLUSTER_MAX } from "./constants.ts";
import type { DrawFile, DrawSource } from "./draw.ts";
import { ENTITIES } from "./entities.ts";
import { DRAW } from "./generated/draw.ts";
import type { ArtShape, ContrastSurface, Entity, MarkVariant } from "./types.ts";

export const ENTITY: Readonly<Record<string, Entity>> = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));

export function entity(id: string | undefined): Entity | undefined {
  return id === undefined ? undefined : ENTITY[id];
}

/** Text that always accompanies (or replaces) the artwork: the ticker when there is one, else the name. */
export function entityLabel(id: string | undefined, fallback = "Unidentified"): string {
  const e = entity(id);
  return e?.symbol ?? e?.name ?? fallback;
}

/** `mono` picks the silhouette for the current scheme (light ink on dark, dark ink on light). */
export type VariantRequest = MarkVariant | "mono";
export type Scheme = "dark" | "light";

/** Order tried for each request. Colour is a fallback for mono; a colour mark is never recoloured into mono. */
const FALLBACKS: Readonly<Record<MarkVariant, readonly MarkVariant[]>> = {
  disc: ["disc", "symbol"],
  symbol: ["symbol", "disc"],
  monoLight: ["monoLight", "symbol", "disc"],
  monoDark: ["monoDark", "symbol", "disc"],
  wordmark: ["wordmark", "wordmarkLight", "symbol", "disc"],
  wordmarkLight: ["wordmarkLight", "wordmark", "symbol", "disc"],
};

/** `mono` and `wordmark` resolve to the ink that suits the scheme first. */
function wantedFor(request: VariantRequest, scheme: Scheme): MarkVariant {
  if (request === "mono") return scheme === "dark" ? "monoLight" : "monoDark";
  if (request === "wordmark" && scheme === "dark") return "wordmarkLight";
  return request;
}

/** Width over height of a viewBox ("minX minY width height"). */
function aspectOf(viewBox: string): number {
  const [, , w, h] = viewBox.split(" ").map(Number);
  return w !== undefined && h !== undefined && h > 0 ? w / h : 1;
}

/** What to draw behind the art: nothing, the theme's neutral plate, or a fixed light/dark plate for contrast. */
export type Plate = "none" | "theme" | "light" | "dark";

export type MarkPlan =
  | {
      kind: "art";
      entity: Entity;
      source: DrawSource;
      variant: MarkVariant;
      file: DrawFile;
      plate: Plate;
      /** The drawn shape (plate or the art's own), so badges and rims follow it. */
      shape: Exclude<ArtShape, "free">;
      /** Wordmarks keep their proportions: drawn `size` tall and `size × aspect` wide. */
      wordmark: boolean;
      aspect: number;
    }
  /** A basket: its members' own marks, overlapped (R2.6). */
  | { kind: "cluster"; entity: Entity; members: Extract<MarkPlan, { kind: "art" }>[] }
  | { kind: "gap"; entity: Entity; reason: string }
  | { kind: "unidentified"; id: string | undefined };

function plateFor(surface: ContrastSurface, scheme: Scheme, needsDisc: boolean): Plate {
  if (surface !== "any" && surface !== scheme) return surface;
  return needsDisc ? "theme" : "none";
}

/** The record that holds a variant's file: the entity's own, else its supplement (a fetched library record). */
function holderOf(source: DrawSource, variant: MarkVariant): DrawSource | undefined {
  if (source.variants[variant]) return source;
  const extra = source.supplement === undefined ? undefined : DRAW[source.supplement];
  return extra?.variants[variant] ? extra : undefined;
}

export function planMark(id: string | undefined, request: VariantRequest, scheme: Scheme): MarkPlan {
  const e = entity(id);
  if (!e) return { kind: "unidentified", id };
  if (e.members && request !== "wordmark" && request !== "wordmarkLight") {
    const members = e.members
      .slice(0, CLUSTER_MAX)
      .map((m) => planMark(m, "disc", scheme))
      .filter((p): p is Extract<MarkPlan, { kind: "art" }> => p.kind === "art");
    if (members.length > 1) return { kind: "cluster", entity: e, members };
  }
  const own = e.art === undefined ? undefined : DRAW[e.art];
  if (!own) return { kind: "gap", entity: e, reason: e.gap ?? `artwork "${e.art}" is not on file` };
  for (const variant of FALLBACKS[wantedFor(request, scheme)]) {
    const source = holderOf(own, variant);
    const file = source?.variants[variant];
    if (!source || !file) continue;
    const wordmark = variant === "wordmark" || variant === "wordmarkLight";
    const needsDisc = request === "disc" && file.shape === "free" && !wordmark;
    const plate = plateFor(file.surface, scheme, needsDisc && !own.noContainer);
    // An owner who forbids containers (Uniswap) gets the next variant that reads on this ground instead of a plate.
    if (own.noContainer && plate !== "none") continue;
    const shape = file.shape === "free" ? "disc" : file.shape;
    return { kind: "art", entity: e, source, variant, file, plate, shape, wordmark, aspect: aspectOf(file.viewBox) };
  }
  return { kind: "gap", entity: e, reason: `artwork "${own.key}" has no drawable variant` };
}

export interface GlyphPlan {
  entity: Entity;
  source: DrawSource;
  variant: MarkVariant;
  file: DrawFile;
}

/** The entity's one-colour glyph (an `ArtFile.tintable` symbol, e.g. the passkey icon), or undefined if it has none. */
export function glyphFor(id: string | undefined): GlyphPlan | undefined {
  const e = entity(id);
  const source = e?.art === undefined ? undefined : DRAW[e.art];
  const file = source?.variants.symbol;
  return e && source && file?.tintable ? { entity: e, source, variant: "symbol", file } : undefined;
}

/** True when the entity's real artwork is on file (a caller can omit an optional mark rather than show a fallback). */
export function hasArt(id: string | undefined): boolean {
  const kind = planMark(id, "symbol", "dark").kind;
  return kind === "art" || kind === "cluster";
}
