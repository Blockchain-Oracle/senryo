/**
 * Draws one frame of the replay (Q3, D-350; the shared layout in `film-scene.ts`) with Skia's imperative API — a
 * worklet, so the preview draws it on the UI thread and the exporter on its own runtime: the same pixels in the app
 * and in the MP4. After Fomo's card: the brand ground, the header (portrait, handle, date, Practice), the chart (a
 * smooth line over its own fill, the head and its dashed rule, the price pill, at most three labels and the KO / Cap
 * tags in the price column, the OPEN / CLOSE discs and tooltips), the centred panel (market and tag, PnL with its ROI,
 * three stats) and the band (lockup, where to play, the QR). Everything comes in; nothing is fetched here.
 */
import { type DrawnFrame, type FilmColours, type FilmWords, FILM_LAYOUT as L } from "@senryo/calls";
import {
  ClipOp,
  PaintStyle,
  type SkCanvas,
  type SkFont,
  type SkImage,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
} from "@shopify/react-native-skia";

export interface FilmFonts {
  handle: SkFont;
  handleSmall: SkFont;
  date: SkFont;
  mode: SkFont;
  label: SkFont;
  tick: SkFont;
  level: SkFont;
  pill: SkFont;
  tipTitle: SkFont;
  tipValue: SkFont;
  tiny: SkFont;
  market: SkFont;
  tag: SkFont;
  pnl: SkFont;
  pnlSmall: SkFont;
  roi: SkFont;
  statLabel: SkFont;
  statValue: SkFont;
  referral: SkFont;
  code: SkFont;
  codeSmall: SkFont;
}

export interface FilmImages {
  mark: SkImage | null;
  portrait: SkImage | null;
  qr: SkImage | null;
  lockup: SkImage | null;
}

const HALF = 2;
const MID = 0.5;
const LABEL_NUDGE = 10;
const PILL_NUDGE = 11;
const LABEL_ALPHA = 0.72;
/** A line of text's box around its baseline, as shares of its size. */
const ASCENT = 0.8;
const DESCENT = 0.2;

function paintOf(color: string, alpha = 1) {
  "worklet";
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  return p;
}

function textAt(c: SkCanvas, s: string, x: number, base: number, font: SkFont, color: string, align = "left", a = 1) {
  "worklet";
  const w = font.measureText(s).width;
  const left = align === "right" ? x - w : align === "center" ? x - w / HALF : x;
  c.drawText(s, left, base, paintOf(color, a), font);
}

const widthOf = (s: string, font: SkFont) => {
  "worklet";
  return font.measureText(s).width;
};

function fit(s: string, font: SkFont, smaller: SkFont, maxW: number): [string, SkFont] {
  "worklet";
  if (widthOf(s, font) <= maxW) return [s, font];
  if (widthOf(s, smaller) <= maxW) return [s, smaller];
  let cut = s;
  while (cut.length > 1 && widthOf(`${cut}…`, smaller) > maxW) cut = cut.slice(0, -1);
  return [`${cut}…`, smaller];
}

function imageAt(c: SkCanvas, img: SkImage | null, x: number, y: number, size: number, radius: number, ink: string) {
  "worklet";
  if (!img) return;
  c.save();
  c.clipRRect(Skia.RRectXY(Skia.XYWHRect(x, y, size, size), radius, radius), ClipOp.Intersect, true);
  c.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(x, y, size, size), paintOf(ink));
  c.restore();
}

function stroke(color: string, width: number, alpha = 1, dash: readonly number[] | null = null) {
  "worklet";
  const p = paintOf(color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setStrokeCap(StrokeCap.Round);
  if (dash) p.setPathEffect(Skia.PathEffect.MakeDash([...dash], 0));
  return p;
}

/** ▲ or ▼ centred on (x, y), drawn — never a font glyph. */
function triangle(c: SkCanvas, x: number, y: number, size: number, up: boolean, color: string, alpha = 1) {
  "worklet";
  const h = size * MID;
  const tip = up ? y - h : y + h;
  const base = up ? y + h : y - h;
  const b = Skia.PathBuilder.Make()
    .moveTo(x, tip)
    .lineTo(x + h, base)
    .lineTo(x - h, base)
    .close();
  c.drawPath(b.build(), paintOf(color, alpha));
}

/** The price column's claims: a text box (baseline, size) is drawn only where it meets no claimed box. */
function columnClaims(pillTop: number, pillH: number) {
  "worklet";
  const gap = L.labels.gap;
  const taken: [number, number][] = [[pillTop - gap, pillTop + pillH + gap]];
  return (base: number, size: number) => {
    "worklet";
    const top = base - size * ASCENT;
    const bottom = base + size * DESCENT;
    if (!taken.every(([a, b]) => bottom <= a || top >= b)) return false;
    taken.push([top - gap, bottom + gap]);
    return true;
  };
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
  const toneOf = (t: string) => (t === "up" ? col.up : t === "down" ? col.down : col.ink);
  const tone = toneOf(f.tone);
  c.drawColor(Skia.Color(col.ground));
  const card = L.card;
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(card.x, card.y, card.w, card.h), card.radius, card.radius), paintOf(col.card));

  // Who and when.
  imageAt(c, img.portrait, L.portrait.x, L.portrait.y, L.portrait.size, L.portrait.size / HALF, col.ink);
  const [handle, handleFont] = fit(w.handle, ft.handle, ft.handleSmall, L.handle.maxW);
  textAt(c, handle, L.handle.x, L.handle.base, handleFont, col.ink);
  if (f.provenanceText) textAt(c, f.provenanceText, L.provenance.x, L.provenance.base, ft.tiny, col.muted);
  textAt(c, w.date, L.date.right, L.date.base, ft.date, col.muted, "right");
  if (w.mode) textAt(c, w.mode, L.mode.right, L.mode.base, ft.mode, col.muted, "right");

  // The chart.
  const p = L.plot;
  const X = (x: number) => p.x + x * p.w;
  const Y = (y: number) => p.y + (1 - y) * p.h;
  const dot = paintOf(col.ink, L.grid.alpha);
  for (let gx = p.x; gx <= p.x + p.w; gx += L.grid.step) {
    for (let gy = p.y; gy <= p.y + p.h; gy += L.grid.step) c.drawCircle(gx, gy, L.grid.dot, dot);
  }
  const level = (kind: string) => f.levels.find((l) => l.kind === kind && !l.edge);
  const line = level("line");
  const low = level("low");
  const high = level("high");
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
  if (zone) {
    const zc = w.zone === "up" ? col.up : w.zone === "down" ? col.down : col.range;
    c.drawRect(Skia.XYWHRect(p.x, Y(zone[0]), p.w, Y(zone[1]) - Y(zone[0])), paintOf(zc, L.level.zoneAlpha));
  }
  // The head, its pill's connector and the discs stay inside the chart whatever the range does.
  const inPlot = (y: number) => Math.min(Math.max(y, p.y), p.y + p.h);
  const headY = inPlot(Y(f.head.y));
  const pillTop = Math.min(L.pill.bottom, Math.max(L.pill.top, headY - L.pill.h / HALF));
  const pillMid = pillTop + L.pill.h / HALF;
  // KO and Cap: a line when in view, and a short tag in the price column (pinned to its edge when beyond the view).
  const tags: { y: number; text: string; colour: string }[] = [];
  for (const l of f.levels) {
    if (l.kind === "low" || l.kind === "high") continue;
    const y = l.edge === "top" ? p.y : l.edge === "bottom" ? p.y + p.h : Y(l.y);
    if (l.kind === "entry" || l.kind === "line") {
      const dash = [L.level.dash, L.level.dash];
      if (!l.edge) c.drawLine(p.x, y, p.x + p.w, y, stroke(col.muted, L.level.width, L.level.entryAlpha, dash));
      continue;
    }
    const colour = l.kind === "ko" ? col.down : col.up;
    if (!l.edge) {
      const dash = l.kind === "ko" ? null : [L.level.dash, L.level.dash];
      c.drawLine(p.x, y, p.x + p.w, y, stroke(colour, L.level.width, 1, dash));
    }
    const word = l.kind === "ko" ? "KO" : "Cap";
    const text = l.edge === "top" ? `↑ ${word}` : l.edge === "bottom" ? `↓ ${word}` : word;
    tags.push({ y, text, colour });
  }
  c.save();
  c.clipRect(Skia.XYWHRect(p.x, p.y - L.line.width, p.w, p.h + L.line.width * HALF), ClipOp.Intersect, true);
  if (f.path.length > 1) {
    // A smooth line through the samples' midpoints (Fomo's spline), with its own fill fading to the plot's foot.
    const pts = f.path.map((q) => ({ x: X(q.x), y: Y(q.y) }));
    const first = pts[0] ?? { x: p.x, y: headY };
    const last = pts[pts.length - 1] ?? first;
    const b = Skia.PathBuilder.Make().moveTo(first.x, first.y);
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i];
      const n = pts[i + 1];
      if (a && n) b.quadTo(a.x, a.y, (a.x + n.x) / HALF, (a.y + n.y) / HALF);
    }
    b.lineTo(last.x, last.y);
    const curve = b.build();
    const area = Skia.PathBuilder.Make()
      .addPath(curve)
      .lineTo(last.x, p.y + p.h)
      .lineTo(first.x, p.y + p.h)
      .close();
    const fill = paintOf(tone);
    fill.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: p.y },
        { x: 0, y: p.y + p.h },
        [Skia.Color(tone), Skia.Color(col.card)],
        null,
        TileMode.Clamp,
      ),
    );
    fill.setAlphaf(L.line.fillAlpha);
    c.drawPath(area.build(), fill);
    c.drawPath(curve, stroke(tone, L.line.width));
  }
  c.restore();
  c.drawLine(p.x, headY, p.x + p.w, headY, stroke(tone, L.rule.width, L.rule.alpha, [L.rule.on, L.rule.off]));
  c.drawCircle(X(f.head.x), headY, L.head.halo, paintOf(tone, L.head.haloAlpha));
  c.drawCircle(X(f.head.x), headY, L.head.r, paintOf(tone));
  if (pillMid !== headY) c.drawLine(L.pill.x, headY, L.pill.x, pillMid, stroke(tone, L.rule.width));
  c.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(L.pill.x, pillTop, L.pill.w, L.pill.h), L.pill.radius, L.pill.radius),
    paintOf(tone),
  );
  textAt(c, f.pillText, L.pill.x + L.pill.w / HALF, pillMid + PILL_NUDGE, ft.pill, col.pillInk, "center");
  // The price column: the pill, then the tags, then the labels — nothing drawn where it would meet a claimed box.
  const claim = columnClaims(pillTop, L.pill.h);
  for (const t of tags) {
    const base = Math.min(Math.max(t.y + LABEL_NUDGE, p.y + L.level.tagSize), p.y + p.h);
    if (claim(base, L.level.tagSize)) textAt(c, t.text, L.labels.right, base, ft.level, t.colour, "right");
  }
  f.labels.forEach((l, i) => {
    const base = Y(l.y) + LABEL_NUDGE;
    if (base - L.labels.size < p.y || base > p.y + p.h || !claim(base, L.labels.size)) return;
    textAt(c, f.labelTexts[i] ?? "", L.labels.right, base, ft.label, col.muted, "right");
  });
  f.ticks.forEach((t, i) => {
    const s = f.tickTexts[i] ?? "";
    const half = widthOf(s, ft.tick) / HALF;
    const x = X(t.x);
    if (x - half < p.x || x + half > p.x + p.w) return;
    textAt(c, s, x, L.ticks.base, ft.tick, col.muted, "center");
  });

  // The moments: a disc on the line, and its tooltip in the empty future beside the head.
  f.moments.forEach((m, i) => {
    if (m.x < 0 || m.x > 1) return;
    const mx = X(m.x);
    const my = inPlot(Y(m.y));
    const out = m.kind === "out";
    const discColour = out ? tone : w.up === null ? col.range : w.up ? col.up : col.down;
    c.drawCircle(mx, my, L.disc.r, paintOf(discColour, m.alpha));
    const g = L.disc.glyph;
    if (out) c.drawRect(Skia.XYWHRect(mx - g, my - g, g * HALF, g * HALF), paintOf(col.pillInk, m.alpha));
    else triangle(c, mx, my, g * HALF, w.up !== false, col.pillInk, m.alpha);
    if (m.tipAlpha <= 0) return;
    const t = L.tip;
    const tx = L.tipText;
    const value = f.momentTexts[i] ?? "";
    const tw = Math.max(
      t.minW,
      widthOf(m.title, ft.tipTitle) + t.padX * HALF,
      widthOf(value, ft.tipValue) + t.padX * HALF,
    );
    const left = Math.min(t.x, t.maxRight - tw);
    const top = Math.min(Math.max(my - t.above, t.top), t.bottom);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(left, top, tw, t.h), t.radius, t.radius), paintOf(col.panel, m.tipAlpha));
    textAt(c, m.title, left + tw / HALF, top + tx.titleBase, ft.tipTitle, col.muted, "center", m.tipAlpha);
    textAt(c, value, left + tw / HALF, top + tx.valueBase, ft.tipValue, col.ink, "center", m.tipAlpha);
  });

  // The trade: one rule, then the market, the PnL with its ROI and three stats — centred.
  const sp = L.separator;
  c.drawLine(sp.x, sp.y, sp.x + sp.w, sp.y, stroke(col.rule, L.rule.width));
  const cx = sp.x + sp.w / HALF;
  const mk = L.market;
  const nameW = widthOf(w.market, ft.market);
  const tagW = widthOf(w.tag, ft.tag);
  const rowLeft = cx - (mk.mark + mk.gap + nameW + mk.gap + tagW) / HALF;
  imageAt(c, img.mark, rowLeft, mk.markY, mk.mark, mk.mark / HALF, col.ink);
  textAt(c, w.market, rowLeft + mk.mark + mk.gap, mk.nameBase, ft.market, col.ink);
  textAt(c, w.tag, rowLeft + mk.mark + mk.gap + nameW + mk.gap, mk.nameBase, ft.tag, col.muted);
  const [pnl, pnlFont] = fit(f.pnlText, ft.pnl, ft.pnlSmall, L.pnl.maxW);
  const pnlW = widthOf(pnl, pnlFont);
  const roiW = f.roiText ? L.pnl.gap + widthOf(f.roiText, ft.roi) : 0;
  const x = cx - (pnlW + roiW) / HALF;
  textAt(c, pnl, x, L.pnl.base, pnlFont, tone);
  if (f.roiText) textAt(c, f.roiText, x + pnlW + L.pnl.gap, L.roi.base, ft.roi, col.ink);
  const st = L.stats;
  w.stats.forEach(([label, value], i) => {
    const mid = st.x + i * st.column + st.column / HALF;
    textAt(c, label, mid, st.labelBase, ft.statLabel, col.muted, "center");
    // The exit's price is held back until the film reaches OUT.
    const shown = i === w.stats.length - 1 && !f.ended ? "—" : value;
    textAt(c, shown, mid, st.valueBase, ft.statValue, col.ink, "center");
  });

  // The band: the lockup, where to play, the QR to the trade.
  if (img.lockup) {
    const lk = img.lockup;
    const to = Skia.XYWHRect(L.lockup.x, L.lockup.y, L.lockup.w, L.lockup.h);
    c.drawImageRect(lk, Skia.XYWHRect(0, 0, lk.width(), lk.height()), to, paintOf(col.ink));
  }
  const rf = L.referral;
  textAt(c, w.referralLabel, rf.x, rf.labelBase, ft.referral, col.groundInk, "left", LABEL_ALPHA);
  const [code, codeFont] = fit(w.code, ft.code, ft.codeSmall, rf.maxW);
  textAt(c, code, rf.x, rf.codeBase, codeFont, col.groundInk);
  imageAt(c, img.qr, L.qr.x, L.qr.y, L.qr.size, L.qr.radius, col.ink);
}
