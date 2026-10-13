/**
 * The replay's frame, shared by both apps' renderers (Q3, D-350; Codex direction 17 §2, amended by the owner's second
 * pass, Codex direction 18 §C): its layout at 1080 × 1350 after Fomo's card — the brand magenta as the 12 px ground
 * and the band, the dark card, the scrolling chart with its price pill, KO / Cap tags in the price column and the
 * OPEN / CLOSE tooltips in the empty future, a flat centred panel with the market, the PnL and three stats, the lockup
 * and the QR in the band — its colours (one look in either theme, D-349), and every frame of a film laid out once with
 * its strings formatted, so the renderers only draw. Every text box has its own place; none can meet another at any t.
 * The phone draws with Skia, the web with a 2D canvas; both from this.
 */
import { priceText, usd } from "@senryo/core";
import { DARK } from "@senryo/tokens";
import { filmOf } from "./film.ts";
import { type FilmFrame, frameAt } from "./film-frame.ts";
import type { FilmZone, ReceiptFilm } from "./film-input.ts";
import { type FilmSound, filmSound } from "./film-sound.ts";
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
  handle: { x: 228, base: 108, size: 52, min: 38, maxW: 440 },
  provenance: { x: 228, base: 160, size: 24 },
  date: { right: 1032, base: 92, size: 32 },
  mode: { right: 1032, base: 160, size: 28 },
  plot: { x: 48, y: 228, w: 776, h: 372 },
  grid: { step: 48, dot: 1.5, alpha: 0.06 },
  line: { width: 8, fillAlpha: 0.22 },
  head: { r: 10, halo: 22, haloAlpha: 0.2 },
  rule: { width: 2, on: 12, off: 12, alpha: 0.5 },
  pill: { x: 848, w: 184, h: 56, radius: 10, size: 32, top: 228, bottom: 544 },
  /** The price column, right-aligned: the pill first, then the level tags, then at most three labels — each text box
   * claims its height plus `gap`, and anything that would meet a claimed box isn't drawn. */
  labels: { right: 1032, size: 28, gap: 8 },
  level: { width: 2, dash: 10, tagSize: 26, entryAlpha: 0.35, zoneAlpha: 0.07 },
  ticks: { base: 684, size: 28 },
  /** Discs on the line; one opaque tooltip in the empty future right of the head (Fomo's BUY / SELL). */
  disc: { r: 24, glyph: 9 },
  tip: { x: 632, minW: 200, maxRight: 832, h: 96, radius: 18, padX: 28, above: 48, top: 228, bottom: 504 },
  tipText: { titleSize: 24, titleBase: 36, valueSize: 30, valueBase: 76 },
  separator: { y: 728, x: 48, w: 984 },
  market: { mark: 60, markY: 756, gap: 16, nameBase: 801, nameSize: 46, tagSize: 28 },
  pnl: { base: 984, size: 104, min: 80, maxW: 940, gap: 24 },
  roi: { base: 972, size: 46 },
  /** Three columns across x 48–1032 (centres 212, 540, 868). */
  stats: { x: 48, column: 328, labelBase: 1058, valueBase: 1118, labelSize: 30, valueSize: 40 },
  lockup: { x: 48, y: 1214, w: 325, h: 88 },
  referral: { x: 440, labelBase: 1240, codeBase: 1296, labelSize: 32, codeSize: 46, codeMin: 34, maxW: 424 },
  qr: { x: 888, y: 1188, size: 144, radius: 16 },
} as const;

export interface FilmColours {
  /** The brand ground: the 12 px frame and the band. */
  ground: string;
  /** Ink on the brand ground. */
  groundInk: string;
  card: string;
  /** The tooltip's fill. */
  panel: string;
  rule: string;
  ink: string;
  muted: string;
  up: string;
  down: string;
  range: string;
  pillInk: string;
}

export const FILM_COLOURS: FilmColours = {
  ground: DARK.accent,
  groundInk: DARK.accentForeground,
  card: DARK.background,
  panel: DARK.card,
  rule: DARK.secondary,
  ink: DARK.foreground,
  muted: DARK.mutedForeground,
  up: DARK.up,
  down: DARK.down,
  range: DARK.range,
  pillInk: DARK.background,
};

export interface DrawnFrame extends FilmFrame {
  pnlText: string;
  /** The signed ROI ("−3.1%"); empty when unknown. */
  roiText: string;
  pillText: string;
  labelTexts: string[];
  tickTexts: string[];
  /** Each moment's tooltip value: the booked amount ("$5.00"), or the price when the amount is unknown. */
  momentTexts: string[];
  provenanceText: string | null;
}

export interface FilmWords {
  handle: string;
  date: string;
  mode: string;
  market: string;
  tag: string;
  /** The trade's side (null for a range): IN's disc colour and triangle. */
  up: boolean | null;
  stats: readonly (readonly [string, string])[];
  referralLabel: string;
  code: string;
  zone: FilmZone;
}

export interface FilmSceneData extends FilmSound {
  totalMs: number;
  frames: DrawnFrame[];
  words: FilmWords;
}

const priceOf = (p: number, unit: ReturnType<typeof unitOf>) => priceText(BigInt(Math.round(p * E8)), unit);
const clockOf = (ms: number, seconds: boolean) =>
  new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });

function drawn(f: FilmFrame, symbol: string, hidden: boolean): DrawnFrame {
  const unit = unitOf(symbol);
  const secondsTicks = f.ticks.length > 1 && (f.ticks[1]?.ms ?? 0) - (f.ticks[0]?.ms ?? 0) < MINUTE_MS;
  return {
    ...f,
    // Hidden balances: no amounts, and no PnL colour on the public price path.
    tone: hidden ? "flat" : f.tone,
    pnlText: f.pnl === null ? "$0.00" : hidden ? HIDDEN : pnlText(BigInt(Math.round(f.pnl * E6))),
    roiText: f.roiBps === null ? "" : hidden ? HIDDEN : roiText(f.roiBps),
    pillText: priceOf(f.head.price, unit),
    labelTexts: f.labels.map((l) => priceOf(l.price, unit)),
    tickTexts: f.ticks.map((t) => clockOf(t.ms, secondsTicks)),
    momentTexts: f.moments.map((m) =>
      m.amount === null ? priceOf(m.price, unit) : hidden ? HIDDEN : usd(BigInt(m.amount)),
    ),
    provenanceText:
      f.provenance.kind === "partial"
        ? `Partial recording · ${f.provenance.coveragePct}%`
        : f.provenance.kind === "rebuilt"
          ? "Rebuilt from 1-minute prices"
          : null,
  };
}

/** Every frame of the film, its words and its soundtrack; `handle` null for a guest. */
export function filmSceneOf(rf: ReceiptFilm | null, handle: string | null, hidden: boolean): FilmSceneData | null {
  const film = rf ? filmOf(rf.input) : null;
  if (!rf || !film) return null;
  const count = Math.ceil((film.totalMs / MS) * FPS) + 1;
  const frames = Array.from({ length: count }, (_, i) => drawn(frameAt(film, (i / FPS) * MS), rf.input.symbol, hidden));
  const stats = rf.copy.stats.map(([k, v]) => [k, hidden && (k === "Stake" || k === "Margin") ? HIDDEN : v] as const);
  return {
    totalMs: film.totalMs,
    frames,
    ...filmSound(film),
    words: {
      handle: handle ? `@${handle}` : "Guest",
      date: rf.copy.date,
      mode: rf.copy.mode,
      market: rf.copy.market,
      tag: rf.copy.tag,
      up: rf.input.up,
      stats,
      // A code belongs here once referrals are captured (R8.4); until then the band names where to play.
      referralLabel: "Play at",
      code: "senryo.xyz",
      zone: rf.copy.zone,
    },
  };
}
