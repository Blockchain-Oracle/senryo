/**
 * Reproducible derivation of a permitted colourway (see `Derivation`): literal colour substitutions plus an optional
 * root fill, nothing else. Plain string work so codegen and the `identity-provenance` invariant run the same code.
 */
import type { Derivation } from "./types.ts";

const ROOT_TAG = /<svg\b/;
const ROOT_FILL = /<svg\b[^>]*\sfill=/;

function escapeLiteral(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deriveSvg(source: string, derivation: Pick<Derivation, "recolour" | "rootFill">): string {
  let out = source;
  for (const [from, to] of Object.entries(derivation.recolour)) {
    // A hex colour must not match the start of a longer hex run (#FFF inside #FFFFFF).
    const tail = from.startsWith("#") ? "(?![0-9a-fA-F])" : "";
    out = out.replace(new RegExp(`${escapeLiteral(from)}${tail}`, "gi"), to);
  }
  if (derivation.rootFill !== undefined) {
    if (!ROOT_TAG.test(out)) throw new Error("deriveSvg: no <svg> root to carry the fill");
    if (ROOT_FILL.test(out)) throw new Error("deriveSvg: the root already has a fill; recolour it instead");
    out = out.replace(ROOT_TAG, `<svg fill="${derivation.rootFill}"`);
  }
  return out;
}
