/**
 * Everything the replay video needs to draw (Q3, D-350): the film from the receipt's records, every frame laid out once
 * with its strings formatted (the worklet only draws), the fixed words, the video's own colours (the dark brand ground
 * and card in either theme — the export has one look, D-349), and the fonts at the frame's sizes. With balances hidden
 * the money reads •••• and the path loses its PnL colour; export is blocked by the caller.
 */
import { type FilmFrame, filmOf, frameAt, pnlText, type ReceiptFilm, roiText, unitOf } from "@senryo/calls";
import { priceText } from "@senryo/core";
import { DARK, KINPAKU } from "@senryo/tokens";
import { Skia, useTypeface } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { HIDDEN_AMOUNT } from "~/lib/hide-balances";
import type { DrawnFrame, FilmColours, FilmFonts, FilmWords } from "./drawFilm";
import { LAYOUT as L } from "./film-layout";

const FPS = 30;
const MS = 1_000;
const E6 = 1e6;
const E8 = 1e8;
const MINUTE_MS = 60_000;

const FONT_FILES = {
  regular: require("../../../assets/fonts/Inter-Regular.ttf"),
  semibold: require("../../../assets/fonts/Inter-SemiBold.ttf"),
  bold: require("../../../assets/fonts/Inter-Bold.ttf"),
  display: require("../../../assets/fonts/RobotoCondensed-Black.ttf"),
};

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

export function useFilmFonts(): FilmFonts | null {
  const regular = useTypeface(FONT_FILES.regular);
  const semibold = useTypeface(FONT_FILES.semibold);
  const bold = useTypeface(FONT_FILES.bold);
  const display = useTypeface(FONT_FILES.display);
  return useMemo(() => {
    if (!regular || !semibold || !bold || !display) return null;
    const f = (tf: typeof regular, size: number) => Skia.Font(tf, size);
    return {
      handle: f(semibold, L.handle.size),
      handleSmall: f(semibold, L.handle.min),
      date: f(regular, L.date.size),
      small: f(regular, L.labels.size),
      caption: f(regular, L.moment.captionSize),
      tiny: f(regular, L.provenance.size),
      pill: f(bold, L.pill.size),
      marker: f(display, L.moment.labelSize),
      market: f(semibold, L.market.nameSize),
      body: f(regular, L.market.idSize),
      pnl: f(display, L.pnl.size),
      pnlSmall: f(display, L.pnl.min),
      roi: f(semibold, L.roi.size),
      statValue: f(semibold, L.stats.valueSize),
      code: f(semibold, L.referral.codeSize),
      codeSmall: f(semibold, L.referral.codeMin),
      stampWord: f(display, L.stamp.wordSize),
    };
  }, [regular, semibold, bold, display]);
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
    tone: hidden ? "flat" : f.tone,
    pnlText: f.pnl === null ? "—" : hidden ? HIDDEN_AMOUNT : pnlText(BigInt(Math.round(f.pnl * E6))),
    roiText: f.roiBps === null ? "" : hidden ? HIDDEN_AMOUNT : roiText(f.roiBps),
    pillText: priceOf(f.head.price, unit),
    labelTexts: f.labels.map((l) => priceOf(l.price, unit)),
    tickTexts: f.ticks.map((t) => clockOf(t.ms, secondsTicks)),
    levelTexts: f.levels.map((l) =>
      l.kind === "line"
        ? "Line"
        : l.kind === "entry"
          ? `Entry ${priceOf(l.price, unit)}`
          : l.kind === "ko"
            ? `KO ${priceOf(l.price, unit)}`
            : l.kind === "cap"
              ? `Cap ${priceOf(l.price, unit)}`
              : priceOf(l.price, unit),
    ),
    provenanceText:
      f.provenance.kind === "partial"
        ? `Partial recording · ${f.provenance.coveragePct}% recorded`
        : f.provenance.kind === "rebuilt"
          ? "Rebuilt · 1-minute prices"
          : null,
  };
}

export interface FilmScene {
  totalMs: number;
  frames: DrawnFrame[];
  words: FilmWords;
  cues: { at: number; cue: string; step: number }[];
}

/** `handle`: the trader's handle (null for a guest: "Guest", "Play on Senryo"). */
export function useFilmScene(rf: ReceiptFilm | null, handle: string | null, hidden: boolean): FilmScene | null {
  return useMemo(() => {
    const film = rf ? filmOf(rf.input) : null;
    if (!rf || !film) return null;
    const count = Math.ceil((film.totalMs / MS) * FPS) + 1;
    const frames = Array.from({ length: count }, (_, i) =>
      drawn(frameAt(film, (i / FPS) * MS), rf.input.symbol, hidden),
    );
    const stats = rf.copy.stats.map(
      ([k, v]) => [k, hidden && (k === "Stake" || k === "Margin") ? HIDDEN_AMOUNT : v] as const,
    );
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
  }, [rf, handle, hidden]);
}
