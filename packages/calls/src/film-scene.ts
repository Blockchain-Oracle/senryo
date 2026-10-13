/**
 * The replay video's frame, shared by both apps' renderers (Q3, D-350; Codex direction 17 §2): its layout at
 * 1080 × 1350 after Fomo's card in Senryo's look, its colours (the dark brand ground and card in either theme — the
 * export has one look, D-349), and every frame of a film laid out once with its strings formatted, so the renderers
 * only draw. The phone draws with Skia, the web with a 2D canvas; both from this.
 */
import { priceText } from "@senryo/core";
import { DARK, KINPAKU } from "@senryo/tokens";
import { filmOf } from "./film.ts";
import { type FilmFrame, frameAt } from "./film-frame.ts";
import type { FilmZone, ReceiptFilm } from "./film-input.ts";
import { unitOf } from "./markets.ts";
import { pnlText, roiText } from "./position-live.ts";

const FPS = 30;
const MS = 1_000;
const E6 = 1e6;
const E8 = 1e8;
const MINUTE_MS = 60_000;
/** What a hidden amount reads (the apps' own mask). */
const HIDDEN = "••••";

export const FILM_LAYOUT = {
  frame: { w: 1080, h: 1350 },
  card: { x: 12, y: 12, w: 1056, h: 1154, radius: 60 },
  portrait: { x: 48, y: 48, size: 144 },
  handle: { x: 228, base: 104, size: 52, min: 38, maxW: 500 },
  date: { right: 1032, base: 92, size: 34 },
  mode: { right: 1032, base: 160, size: 28 },
  stamp: { x: 228, y: 124, size: 104, ring: 4, rule: 7, wordSize: 24, tiltDeg: -4 },
  plot: { x: 48, y: 264, w: 776, h: 368 },
  grid: { step: 48, dot: 1.5, alpha: 0.06 },
  line: { width: 6, glow: 24, glowAlpha: 0.14 },
  head: { r: 10 },
  rule: { width: 2, on: 12, off: 12, alpha: 0.4 },
  pill: { x: 848, w: 184, h: 56, radius: 10, size: 32, top: 264, bottom: 576 },
  labels: { right: 1032, size: 28, clear: 40 },
  ticks: { base: 676, size: 28 },
  level: { width: 2, dash: 10, labelSize: 26, zoneAlpha: 0.07 },
  moment: { notch: 24, leader: 2, labelSize: 30, captionSize: 26, maxW: 280, gap: 12 },
  provenance: { x: 48, base: 724, size: 24 },
  panel: { x: 48, y: 728, w: 984 },
  market: { mark: 72, markY: 756, x: 140, nameBase: 798, nameSize: 44, idBase: 846, idSize: 30 },
  figure: { base: 892, size: 28 },
  pnl: { base: 1006, size: 112, min: 88, maxW: 660 },
  roi: { x: 740, base: 978, size: 46 },
  /** Three columns from the panel's left edge (x 48, 376, 704). */
  stats: { column: 328, labelBase: 1068, valueBase: 1118, labelSize: 30, valueSize: 40 },
  lockup: { x: 48, y: 1214, w: 325, h: 88 },
  referral: { x: 440, labelBase: 1232, codeBase: 1290, labelSize: 30, codeSize: 42, codeMin: 28, maxW: 384 },
  qr: { x: 888, y: 1188, size: 144 },
} as const;

export interface FilmColours {
  ground: string;
  card: string;
  ink: string;
  muted: string;
  up: string;
  down: string;
  range: string;
  pillInk: string;
  foilLight: string;
  foilDeep: string;
  foilHighlight: string;
  lacquer: string;
}

export const FILM_COLOURS: FilmColours = {
  ground: DARK.background,
  card: DARK.card,
  ink: DARK.foreground,
  muted: DARK.mutedForeground,
  up: DARK.up,
  down: DARK.down,
  range: DARK.range,
  pillInk: DARK.background,
  foilLight: KINPAKU.foilLight,
  foilDeep: KINPAKU.foilDeep,
  foilHighlight: KINPAKU.foilHighlight,
  lacquer: KINPAKU.lacquer,
};

export interface DrawnFrame extends FilmFrame {
  pnlText: string;
  roiText: string;
  pillText: string;
  labelTexts: string[];
  tickTexts: string[];
  levelTexts: string[];
  provenanceText: string | null;
}

export interface FilmWords {
  handle: string;
  date: string;
  mode: string;
  stamp: readonly string[] | null;
  market: string;
  identity: string;
  figureLabel: string;
  stats: readonly (readonly [string, string])[];
  referralLabel: string;
  code: string;
  zone: FilmZone;
}

export interface FilmSceneData {
  totalMs: number;
  frames: DrawnFrame[];
  words: FilmWords;
  cues: { at: number; cue: string; step: number }[];
}

const priceOf = (p: number, unit: ReturnType<typeof unitOf>) => priceText(BigInt(Math.round(p * E8)), unit);
const clockOf = (ms: number, seconds: boolean) =>
  new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
const LEVEL_WORD: Partial<Record<string, string>> = { entry: "Entry", ko: "KO", cap: "Cap" };

function drawn(f: FilmFrame, symbol: string, hidden: boolean): DrawnFrame {
  const unit = unitOf(symbol);
  const secondsTicks = f.ticks.length > 1 && (f.ticks[1]?.ms ?? 0) - (f.ticks[0]?.ms ?? 0) < MINUTE_MS;
  return {
    ...f,
    // Hidden balances: no amounts, and no PnL colour on the public price path.
    tone: hidden ? "flat" : f.tone,
    pnlText: f.pnl === null ? "—" : hidden ? HIDDEN : pnlText(BigInt(Math.round(f.pnl * E6))),
    roiText: f.roiBps === null ? "" : hidden ? HIDDEN : roiText(f.roiBps),
    pillText: priceOf(f.head.price, unit),
    labelTexts: f.labels.map((l) => priceOf(l.price, unit)),
    tickTexts: f.ticks.map((t) => clockOf(t.ms, secondsTicks)),
    levelTexts: f.levels.map((l) => {
      if (l.kind === "line") return "Line";
      const word = LEVEL_WORD[l.kind];
      return word ? `${word} ${priceOf(l.price, unit)}` : priceOf(l.price, unit);
    }),
    provenanceText:
      f.provenance.kind === "partial"
        ? `Partial recording · ${f.provenance.coveragePct}% recorded`
        : f.provenance.kind === "rebuilt"
          ? "Rebuilt · 1-minute prices"
          : null,
  };
}

/** Every frame of the film and its words; `handle` null for a guest ("Guest", "Play on Senryo"). */
export function filmSceneOf(rf: ReceiptFilm | null, handle: string | null, hidden: boolean): FilmSceneData | null {
  const film = rf ? filmOf(rf.input) : null;
  if (!rf || !film) return null;
  const count = Math.ceil((film.totalMs / MS) * FPS) + 1;
  const frames = Array.from({ length: count }, (_, i) => drawn(frameAt(film, (i / FPS) * MS), rf.input.symbol, hidden));
  const stats = rf.copy.stats.map(([k, v]) => [k, hidden && (k === "Stake" || k === "Margin") ? HIDDEN : v] as const);
  return {
    totalMs: film.totalMs,
    frames,
    cues: film.cues,
    words: {
      handle: handle ? `@${handle}` : "Guest",
      date: rf.copy.date,
      mode: rf.copy.mode,
      stamp: rf.copy.stamp,
      market: rf.copy.market,
      identity: rf.copy.identity,
      figureLabel: rf.copy.figureLabel,
      stats,
      referralLabel: handle ? "Play with code" : "Play on Senryo",
      code: handle ? `@${handle}` : "senryo.xyz",
      zone: rf.copy.zone,
    },
  };
}
