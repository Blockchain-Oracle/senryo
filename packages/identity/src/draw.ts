/**
 * What drawing a mark needs from an artwork record, and nothing else: no URLs, hashes, licences or dates. Codegen
 * writes `generated/draw.ts` with `drawOf` over every record, the planner reads only that table, and the invariant
 * `identity-provenance` re-projects the records and compares, so an app never ships provenance it doesn't draw with.
 */
import type { ArtFile, ArtSource, MarkVariant } from "./types.ts";

export type DrawFile = Pick<ArtFile, "viewBox" | "insetPermille" | "surface" | "shape" | "tintable" | "minPx">;

export interface DrawSource {
  key: string;
  noContainer?: boolean;
  supplement?: string;
  variants: Partial<Record<MarkVariant, DrawFile>>;
}

function drawFile(f: ArtFile): DrawFile {
  return {
    viewBox: f.viewBox,
    insetPermille: f.insetPermille,
    surface: f.surface,
    shape: f.shape,
    ...(f.tintable ? { tintable: true } : {}),
    ...(f.minPx === undefined ? {} : { minPx: f.minPx }),
  };
}

export function drawOf(s: ArtSource): DrawSource {
  const variants = Object.fromEntries(
    (Object.entries(s.variants) as [MarkVariant, ArtFile][]).map(([v, f]) => [v, drawFile(f)]),
  ) as DrawSource["variants"];
  return {
    key: s.key,
    ...(s.noContainer ? { noContainer: true } : {}),
    ...(s.supplement === undefined ? {} : { supplement: s.supplement }),
    variants,
  };
}
