/**
 * Draws one frame of the replay film (Q3, D-350; Codex direction 17 §2) with Skia's imperative API — a worklet, so the
 * preview draws it on the UI thread and the exporter on its own runtime: the same pixels in the app and in the MP4.
 * Everything comes in: the frame (from `frameAt`, its strings formatted on the JS side), the fixed words, the colours,
 * the fonts, and the images (the market mark, the portrait and the QR, snapshotted from the app's own views; the
 * lockup as SVG).
 */
import type { FilmFrame } from "@senryo/calls";
import {
  ClipOp,
  PaintStyle,
  type SkCanvas,
  type SkFont,
  type SkImage,
  Skia,
  type SkSVG,
  StrokeCap,
  StrokeJoin,
  TileMode,
} from "@shopify/react-native-skia";
import { LAYOUT as L } from "./film-layout";

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
  /** Which side of the line wins (calls): the zone it tints. */
  zone: "up" | "down" | "range" | "beyond-high" | "beyond-low" | null;
}

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

export interface FilmFonts {
  handle: SkFont;
  handleSmall: SkFont;
  date: SkFont;
  small: SkFont;
  caption: SkFont;
  tiny: SkFont;
  pill: SkFont;
  marker: SkFont;
  market: SkFont;
  body: SkFont;
  pnl: SkFont;
  pnlSmall: SkFont;
  roi: SkFont;
  statValue: SkFont;
  code: SkFont;
  codeSmall: SkFont;
  stampWord: SkFont;
}

export interface FilmImages {
  mark: SkImage | null;
  portrait: SkImage | null;
  qr: SkImage | null;
  lockup: SkSVG | null;
}

const HALF = 2;
const LINE_GAP = 4;
/** A point in the upper half takes its caption below; one in the lower half, above. */
const MID = 0.5;
const STAMP_RULE_ALPHA = 0.5;
const HAIRLINE_ALPHA = 0.24;

function paintOf(color: string, alpha = 1) {
  "worklet";
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  return p;
}

function textAt(
  c: SkCanvas,
  s: string,
  x: number,
  base: number,
  font: SkFont,
  color: string,
  align = "left",
  alpha = 1,
) {
  "worklet";
  const w = font.measureText(s).width;
  const left = align === "right" ? x - w : align === "center" ? x - w / HALF : x;
  c.drawText(s, left, base, paintOf(color, alpha), font);
}

function fit(s: string, font: SkFont, smaller: SkFont, maxW: number): [string, SkFont] {
  "worklet";
  if (font.measureText(s).width <= maxW) return [s, font];
  if (smaller.measureText(s).width <= maxW) return [s, smaller];
  let cut = s;
  while (cut.length > 1 && smaller.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1);
  return [`${cut}…`, smaller];
}

function imageAt(c: SkCanvas, img: SkImage | null, x: number, y: number, size: number, round: boolean, ink: string) {
  "worklet";
  if (!img) return;
  c.save();
  if (round)
    c.clipRRect(Skia.RRectXY(Skia.XYWHRect(x, y, size, size), size / HALF, size / HALF), ClipOp.Intersect, true);
  c.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(x, y, size, size), paintOf(ink));
  c.restore();
}

function dashed(color: string, alpha: number, width: number, on: number, off: number) {
  "worklet";
  const p = paintOf(color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setPathEffect(Skia.PathEffect.MakeDash([on, off], 0));
  return p;
}

function drawStamp(c: SkCanvas, lines: readonly string[], col: FilmColours, font: SkFont) {
  "worklet";
  const s = L.stamp;
  c.save();
  c.translate(s.x + s.size / HALF, s.y + s.size / HALF);
  c.rotate(s.tiltDeg, 0, 0);
  const box = Skia.XYWHRect(-s.size / HALF, -s.size / HALF, s.size, s.size);
  const foil = paintOf(col.foilLight);
  foil.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: box.x, y: box.y },
      { x: box.x + s.size, y: box.y + s.size },
      [Skia.Color(col.foilLight), Skia.Color(col.foilDeep)],
      null,
      TileMode.Clamp,
    ),
  );
  c.drawRect(box, foil);
  const inner = s.size - s.ring * HALF;
  c.drawRect(Skia.XYWHRect(-inner / HALF, -inner / HALF, inner, inner), paintOf(col.lacquer));
  const ruleSize = s.size - s.rule * HALF;
  const rule = paintOf(col.foilHighlight, STAMP_RULE_ALPHA);
  rule.setStyle(PaintStyle.Stroke);
  rule.setStrokeWidth(1);
  c.drawRect(Skia.XYWHRect(-ruleSize / HALF, -ruleSize / HALF, ruleSize, ruleSize), rule);
  const lineH = s.wordSize + LINE_GAP;
  const top = -((lines.length - 1) * lineH) / HALF + s.wordSize / HALF - LINE_GAP;
  lines.forEach((w, i) => {
    textAt(c, w.toUpperCase(), 0, top + i * lineH, font, col.foilHighlight, "center");
  });
  c.restore();
}

export function drawFilmFrame(
  c: SkCanvas,
  f: DrawnFrame,
  w: FilmWords,
  col: FilmColours,
  ft: FilmFonts,
  img: FilmImages,
) {
  "worklet";
  const tone = f.tone === "up" ? col.up : f.tone === "down" ? col.down : col.ink;
  c.drawColor(Skia.Color(col.ground));
  const card = L.card;
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(card.x, card.y, card.w, card.h), card.radius, card.radius), paintOf(col.card));

  // Who, when, how it went.
  imageAt(c, img.portrait, L.portrait.x, L.portrait.y, L.portrait.size, true, col.ink);
  const [handle, handleFont] = fit(w.handle, ft.handle, ft.handleSmall, L.handle.maxW);
  textAt(c, handle, L.handle.x, L.handle.base, handleFont, col.ink);
  textAt(c, w.date, L.date.right, L.date.base, ft.date, col.muted, "right");
  textAt(c, w.mode, L.mode.right, L.mode.base, ft.small, col.muted, "right");
  if (w.stamp) drawStamp(c, w.stamp, col, ft.stampWord);

  // The plot: the dot grid, the winning zone and levels, the path, the head and its rule, the moments.
  const p = L.plot;
  const X = (x: number) => p.x + x * p.w;
  const Y = (y: number) => p.y + (1 - y) * p.h;
  const dot = paintOf(col.ink, L.grid.alpha);
  for (let gx = p.x; gx <= p.x + p.w; gx += L.grid.step) {
    for (let gy = p.y; gy <= p.y + p.h; gy += L.grid.step) c.drawCircle(gx, gy, L.grid.dot, dot);
  }
  const level = (kind: string) => f.levels.find((l) => l.kind === kind);
  const line = level("line");
  const low = level("low");
  const high = level("high");
  const zoneColour = w.zone === "up" ? col.up : w.zone === "down" ? col.down : col.range;
  const zone: readonly [number, number] | null =
    w.zone === "range" && low && high
      ? [high.y, low.y]
      : w.zone === "up" && line
        ? [1, line.y]
        : w.zone === "down" && line
          ? [line.y, 0]
          : w.zone === "beyond-high" && low
            ? [1, low.y]
            : w.zone === "beyond-low" && high
              ? [high.y, 0]
              : null;
  const [zoneTop, zoneBottom] = zone ?? [0, 0];
  if (zone) {
    c.drawRect(Skia.XYWHRect(p.x, Y(zoneTop), p.w, Y(zoneBottom) - Y(zoneTop)), paintOf(zoneColour, L.level.zoneAlpha));
  }
  f.levels.forEach((l, i) => {
    const label = f.levelTexts[i] ?? "";
    if (l.edge) {
      const arrow = l.edge === "top" ? "↑" : "↓";
      const base = l.edge === "top" ? p.y + L.level.labelSize : p.y + p.h - LINE_GAP;
      textAt(
        c,
        `${arrow} ${label}`,
        p.x,
        base,
        ft.caption,
        l.kind === "ko" ? col.down : l.kind === "cap" ? col.up : col.muted,
      );
      return;
    }
    if (l.kind === "low" || l.kind === "high") return;
    const colour = l.kind === "ko" ? col.down : l.kind === "cap" ? col.up : col.muted;
    // A knock-out is a hard solid boundary; the cap, the entry and the line are dashed.
    const paint = dashed(colour, 1, L.level.width, L.level.dash, l.kind === "ko" ? 0 : L.level.dash);
    c.drawLine(p.x, Y(l.y), p.x + p.w, Y(l.y), paint);
    textAt(c, label, p.x, Y(l.y) - LINE_GAP * HALF, ft.caption, colour);
  });
  c.save();
  c.clipRect(Skia.XYWHRect(p.x, p.y - L.line.glow, p.w, p.h + L.line.glow * HALF), ClipOp.Intersect, true);
  const first = f.path[0];
  if (first) {
    const b = Skia.PathBuilder.Make().moveTo(X(first.x), Y(first.y));
    for (let i = 1; i < f.path.length; i++) {
      const q = f.path[i];
      if (q) b.lineTo(X(q.x), Y(q.y));
    }
    const path = b.build();
    for (const [width, alpha] of [
      [L.line.glow, L.line.glowAlpha],
      [L.line.width, 1],
    ] as const) {
      const s = paintOf(tone, alpha);
      s.setStyle(PaintStyle.Stroke);
      s.setStrokeWidth(width);
      s.setStrokeJoin(StrokeJoin.Round);
      s.setStrokeCap(StrokeCap.Round);
      c.drawPath(path, s);
    }
  }
  for (const m of f.moments) {
    if (m.x < 0 || m.x > 1) continue;
    const mx = X(m.x);
    const my = Y(m.y);
    const notch = paintOf(col.ink, m.alpha);
    notch.setStrokeWidth(L.moment.leader);
    c.drawLine(mx, my - L.moment.notch / HALF, mx, my + L.moment.notch / HALF, notch);
    const below = m.y > MID;
    const labelBase = below ? my + L.moment.notch + L.moment.labelSize : my - L.moment.notch;
    const cx = Math.min(Math.max(mx, p.x + L.moment.maxW / HALF), p.x + p.w - L.moment.maxW / HALF);
    textAt(c, m.label, cx, labelBase, ft.marker, col.ink, "center", m.alpha);
    if (m.captionAlpha > 0) {
      const capBase = below
        ? labelBase + L.moment.captionSize + L.moment.gap
        : labelBase - L.moment.labelSize - L.moment.gap;
      textAt(c, m.caption, cx, capBase, ft.caption, col.muted, "center", m.captionAlpha);
    }
  }
  c.restore();
  const headY = Y(f.head.y);
  c.drawLine(p.x, headY, p.x + p.w, headY, dashed(tone, L.rule.alpha, L.rule.width, L.rule.on, L.rule.off));
  c.drawCircle(X(f.head.x), headY, L.head.r, paintOf(tone));
  const pillTop = Math.min(L.pill.bottom, Math.max(L.pill.top, headY - L.pill.h / HALF));
  if (pillTop !== headY - L.pill.h / HALF) {
    const leader = paintOf(tone);
    leader.setStrokeWidth(L.rule.width);
    c.drawLine(L.pill.x, headY, L.pill.x, pillTop + L.pill.h / HALF, leader);
  }
  c.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(L.pill.x, pillTop, L.pill.w, L.pill.h), L.pill.radius, L.pill.radius),
    paintOf(tone),
  );
  textAt(
    c,
    f.pillText,
    L.pill.x + L.pill.w / HALF,
    pillTop + L.pill.h / HALF + L.pill.size / HALF - LINE_GAP * HALF,
    ft.pill,
    col.pillInk,
    "center",
  );
  f.labels.forEach((l, i) => {
    const ly = Y(l.y);
    if (Math.abs(ly - (pillTop + L.pill.h / HALF)) < L.labels.clear || ly < p.y || ly > p.y + p.h) return;
    textAt(
      c,
      f.labelTexts[i] ?? "",
      L.labels.right,
      ly + L.labels.size / HALF - LINE_GAP,
      ft.small,
      col.muted,
      "right",
    );
  });
  f.ticks.forEach((t, i) => {
    if (t.x < 0 || t.x > 1) return;
    textAt(c, f.tickTexts[i] ?? "", X(t.x), L.ticks.base, ft.small, col.muted, "center");
  });
  if (f.provenanceText) textAt(c, f.provenanceText, L.provenance.x, L.provenance.base, ft.tiny, col.muted);

  // The trade: one hairline, the market, the figure, ROI, three stats.
  const pn = L.panel;
  c.drawLine(pn.x, pn.y, pn.x + pn.w, pn.y, paintOf(col.muted, HAIRLINE_ALPHA));
  imageAt(c, img.mark, pn.x, L.market.markY, L.market.mark, true, col.ink);
  textAt(c, w.market, L.market.x, L.market.nameBase, ft.market, col.ink);
  textAt(c, w.identity, L.market.x, L.market.idBase, ft.body, col.muted);
  textAt(c, w.figureLabel, pn.x, L.figure.base, ft.small, col.muted);
  const [pnl, pnlFont] = fit(f.pnlText, ft.pnl, ft.pnlSmall, L.pnl.maxW);
  textAt(c, pnl, pn.x, L.pnl.base, pnlFont, tone);
  textAt(c, f.roiText, L.roi.x, L.roi.base, ft.roi, col.ink);
  w.stats.forEach(([label, value], i) => {
    const x = pn.x + i * L.stats.column;
    textAt(c, label, x, L.stats.labelBase, ft.body, col.muted);
    // The exit's price is held back until the film reaches OUT.
    textAt(c, i === w.stats.length - 1 && !f.ended ? "—" : value, x, L.stats.valueBase, ft.statValue, col.ink);
  });

  // The band: the lockup, the code, the QR to the trade.
  if (img.lockup) {
    c.save();
    c.translate(L.lockup.x, L.lockup.y);
    c.drawSvg(img.lockup, L.lockup.w, L.lockup.h);
    c.restore();
  }
  textAt(c, w.referralLabel, L.referral.x, L.referral.labelBase, ft.body, col.muted);
  // A code shrinks to fit but is never cut.
  const codeFont = ft.code.measureText(w.code).width <= L.referral.maxW ? ft.code : ft.codeSmall;
  textAt(c, w.code, L.referral.x, L.referral.codeBase, codeFont, col.ink);
  imageAt(c, img.qr, L.qr.x, L.qr.y, L.qr.size, false, col.ink);
}
