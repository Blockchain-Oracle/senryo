/**
 * The few colours EntityMark needs from the host app (it never imports an app theme). Mobile passes its palette roles;
 * web passes CSS variables. Layout ratios live in ./constants.ts.
 */
import {
  CLUSTER_MAX,
  CLUSTER_PAIR_RATIO,
  CLUSTER_RING_RATIO,
  CLUSTER_TRIO_RATIO,
  FALLBACK_FONT_RATIO,
  FALLBACK_FONT_RATIO_LONG,
  FALLBACK_MAX_CHARS,
  FALLBACK_SHORT_CHARS,
  PERMILLE,
  PLATE_PADDING_RATIO,
} from "./constants.ts";
import type { MarkPlan, Scheme } from "./registry.ts";

export interface IdentityTheme {
  scheme: Scheme;
  /** The neutral disc drawn behind an uncontained mark. */
  plate: string;
  /** Hairline around plates and fallbacks. */
  rim: string;
  /** Fixed light / dark grounds for marks whose contrast needs them regardless of theme. */
  plateLight: string;
  plateDark: string;
  /** The surface the mark sits on: the cut-out ring around a badge. */
  ground: string;
  /** Loading disc. */
  skeleton: string;
  /** Unidentified / failed fallback: its text colour. */
  fallbackInk: string;
  /** Font family for fallback text (mobile loads named faces; web inherits when omitted). */
  fontFamily?: string;
}

/** Short, readable text for a fallback disc. */
export function fallbackText(label: string): string {
  const first = label.split(/[\s/·]+/)[0] ?? "";
  return first.replace(/[^A-Za-z0-9]/g, "").slice(0, FALLBACK_MAX_CHARS) || "?";
}

export function fallbackFontSize(size: number, text: string): number {
  return size * (text.length > FALLBACK_SHORT_CHARS ? FALLBACK_FONT_RATIO_LONG : FALLBACK_FONT_RATIO);
}

/**
 * The art's drawn edge. A contained disc/tile is scaled to cancel its own built-in margin (so it fills its box and any
 * contrast plate exactly); an uncontained mark on a plate is inset by the plate padding and scaled the same way, so
 * every plate reads at the same optical size.
 */
export function innerSize(size: number, insetPermille: number, plated: boolean, contained: boolean): number {
  const fill = 1 - (2 * insetPermille) / PERMILLE;
  if (contained) return size / fill;
  return plated ? (size * (1 - 2 * PLATE_PADDING_RATIO)) / fill : size;
}

/** The rendered box: marks are square and never below the owner's minimum; wordmarks keep their proportions. */
export function markBox(plan: MarkPlan | undefined, size: number): { width: number; height: number } {
  if (plan?.kind !== "art") return { width: size, height: size };
  const min = plan.file.minPx ?? 0;
  if (plan.wordmark) {
    const height = Math.max(size, min / plan.aspect);
    return { width: height * plan.aspect, height };
  }
  const edge = Math.max(size, min);
  return { width: edge, height: edge };
}

/** Where each member of a basket's mark sits: discs of `outer` with the member drawn at `inner` inside a ground ring. */
export interface ClusterSlot {
  x: number;
  y: number;
  outer: number;
  inner: number;
}

/** Two members on a diagonal, three in a triangle (drawn bottom-left, bottom-right, then the top one over them). */
export function clusterLayout(size: number, count: number): ClusterSlot[] {
  const trio = count >= CLUSTER_MAX;
  const outer = Math.round(size * (trio ? CLUSTER_TRIO_RATIO : CLUSTER_PAIR_RATIO));
  const ring = Math.max(1, Math.round(outer * CLUSTER_RING_RATIO));
  const far = size - outer;
  const spots: [number, number][] = trio
    ? [
        [0, far],
        [far, far],
        [far / 2, 0],
      ]
    : [
        [0, 0],
        [far, far],
      ];
  return spots.map(([x, y]) => ({ x, y, outer, inner: outer - ring * 2 }));
}
