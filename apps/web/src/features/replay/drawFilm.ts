/**
 * Draws one frame of the replay on a 2D canvas (Q3, D-350; the shared layout in `film-scene.ts`; the phone's `drawFilm`
 * with Skia): the same 1080 × 1350 card from the same layout and frame data, so a replay made on the web matches one
 * made on the phone. After Fomo's card: the brand ground, the header, the chart with its KO / Cap tags and its
 * OPEN / CLOSE discs and tooltips, the centred panel and the band. The preview and the exporter both call it; the
 * exporter at t = i / 30.
 */
import { type DrawnFrame, type FilmColours, type FilmWords, FILM_LAYOUT as L } from "@senryo/calls";

export interface FilmFaces {
  /** CSS font-family lists, resolved from the app's own faces. */
  sans: string;
  display: string;
}

export interface FilmImagesWeb {
  mark: CanvasImageSource | null;
  portrait: CanvasImageSource | null;
  qr: CanvasImageSource | null;
  lockup: CanvasImageSource | null;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HALF = 2;
const MID = 0.5;
const LABEL_NUDGE = 10;
const PILL_NUDGE = 11;
const LABEL_ALPHA = 0.72;
/** A line of text's box around its baseline, as shares of its size. */
const ASCENT = 0.8;
const DESCENT = 0.2;
const WEIGHT = { regular: 400, semibold: 600, bold: 700, black: 900 } as const;

const font = (f: FilmFaces, weight: number, size: number, display = false) =>
  `${weight} ${size}px ${display ? f.display : f.sans}`;

function textAt(
  c: Ctx,
  s: string,
  x: number,
  base: number,
  css: string,
  color: string,
  align: CanvasTextAlign = "left",
  alpha = 1,
) {
  c.save();
  c.globalAlpha = alpha;
  c.font = css;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.fillText(s, x, base);
  c.restore();
}

function width(c: Ctx, s: string, css: string): number {
  c.font = css;
  return c.measureText(s).width;
}

function fit(c: Ctx, s: string, big: string, small: string, maxW: number): [string, string] {
  if (width(c, s, big) <= maxW) return [s, big];
  if (width(c, s, small) <= maxW) return [s, small];
  let cut = s;
  while (cut.length > 1 && width(c, `${cut}…`, small) > maxW) cut = cut.slice(0, -1);
  return [`${cut}…`, small];
}

function imageAt(c: Ctx, img: CanvasImageSource | null, x: number, y: number, size: number, radius: number) {
  if (!img) return;
  c.save();
  c.beginPath();
  c.roundRect(x, y, size, size, radius);
  c.clip();
  c.drawImage(img, x, y, size, size);
  c.restore();
}

function rule(
  c: Ctx,
  from: [number, number],
  to: [number, number],
  color: string,
  w: number,
  dash: number[] = [],
  a = 1,
) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = "round";
  c.setLineDash(dash);
  c.beginPath();
  c.moveTo(from[0], from[1]);
  c.lineTo(to[0], to[1]);
  c.stroke();
  c.restore();
}

function roundBox(c: Ctx, box: [number, number, number, number], r: number, fill: string, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(box[0], box[1], box[2], box[3], r);
  c.fill();
  c.restore();
}

function disc(c: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * HALF);
  c.fill();
  c.restore();
}

/** ▲ or ▼ centred on (x, y), drawn — never a font glyph. */
function triangle(c: Ctx, x: number, y: number, size: number, up: boolean, color: string, alpha = 1) {
  const h = size * MID;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, up ? y - h : y + h);
  c.lineTo(x + h, up ? y + h : y - h);
  c.lineTo(x - h, up ? y + h : y - h);
  c.closePath();
  c.fill();
  c.restore();
}

/** The price column's claims: a text box (baseline, size) is drawn only where it meets no claimed box. */
function columnClaims(pillTop: number, pillH: number) {
  const gap = L.labels.gap;
  const taken: [number, number][] = [[pillTop - gap, pillTop + pillH + gap]];
  return (base: number, size: number) => {
    const top = base - size * ASCENT;
    const bottom = base + size * DESCENT;
    if (!taken.every(([a, b]) => bottom <= a || top >= b)) return false;
    taken.push([top - gap, bottom + gap]);
    return true;
  };
}

export function drawFilmFrame(
  c: Ctx,
  f: DrawnFrame,
  w: FilmWords,
  col: FilmColours,
  faces: FilmFaces,
  img: FilmImagesWeb,
) {
  const toneOf = (t: string) => (t === "up" ? col.up : t === "down" ? col.down : col.ink);
  const tone = toneOf(f.tone);
  const regular = (size: number) => font(faces, WEIGHT.regular, size);
  const semibold = (size: number) => font(faces, WEIGHT.semibold, size);
  const bold = (size: number) => font(faces, WEIGHT.bold, size);
  c.fillStyle = col.ground;
  c.fillRect(0, 0, L.frame.w, L.frame.h);
  roundBox(c, [L.card.x, L.card.y, L.card.w, L.card.h], L.card.radius, col.card);

  // Who and when.
  imageAt(c, img.portrait, L.portrait.x, L.portrait.y, L.portrait.size, L.portrait.size / HALF);
  const [handle, handleFont] = fit(c, w.handle, semibold(L.handle.size), semibold(L.handle.min), L.handle.maxW);
  textAt(c, handle, L.handle.x, L.handle.base, handleFont, col.ink);
  if (f.provenanceText) {
    textAt(c, f.provenanceText, L.provenance.x, L.provenance.base, regular(L.provenance.size), col.muted);
  }
  textAt(c, w.date, L.date.right, L.date.base, regular(L.date.size), col.muted, "right");
  if (w.mode) textAt(c, w.mode, L.mode.right, L.mode.base, regular(L.mode.size), col.muted, "right");

  // The chart.
  const p = L.plot;
  const X = (x: number) => p.x + x * p.w;
  const Y = (y: number) => p.y + (1 - y) * p.h;
  for (let gx = p.x; gx <= p.x + p.w; gx += L.grid.step) {
    for (let gy = p.y; gy <= p.y + p.h; gy += L.grid.step) disc(c, gx, gy, L.grid.dot, col.ink, L.grid.alpha);
  }
  const level = (kind: string) => f.levels.find((l) => l.kind === kind && !l.edge);
  const ln = level("line");
  const low = level("low");
  const high = level("high");
  const zone: readonly [number, number] | null =
    w.zone === "range" && low && high
      ? [high.y, low.y]
      : w.zone === "up" && ln
        ? [1, ln.y]
        : w.zone === "down" && ln
          ? [ln.y, 0]
          : w.zone === "beyond-high" && low
            ? [1, low.y]
            : w.zone === "beyond-low" && high
              ? [high.y, 0]
              : null;
  if (zone) {
    const zc = w.zone === "up" ? col.up : w.zone === "down" ? col.down : col.range;
    roundBox(c, [p.x, Y(zone[0]), p.w, Y(zone[1]) - Y(zone[0])], 0, zc, L.level.zoneAlpha);
  }
  // The head, its pill's connector and the discs stay inside the chart whatever the range does.
  const inPlot = (y: number) => Math.min(Math.max(y, p.y), p.y + p.h);
  const headY = inPlot(Y(f.head.y));
  const pillTop = Math.min(L.pill.bottom, Math.max(L.pill.top, headY - L.pill.h / HALF));
  const pillMid = pillTop + L.pill.h / HALF;
  // KO and Cap: a line when in view, and a short tag in the price column (pinned to its edge when beyond the view).
  const dash = [L.level.dash, L.level.dash];
  const tags: { y: number; text: string; colour: string }[] = [];
  for (const l of f.levels) {
    if (l.kind === "low" || l.kind === "high") continue;
    const y = l.edge === "top" ? p.y : l.edge === "bottom" ? p.y + p.h : Y(l.y);
    if (l.kind === "entry" || l.kind === "line") {
      if (!l.edge) rule(c, [p.x, y], [p.x + p.w, y], col.muted, L.level.width, dash, L.level.entryAlpha);
      continue;
    }
    const colour = l.kind === "ko" ? col.down : col.up;
    if (!l.edge) rule(c, [p.x, y], [p.x + p.w, y], colour, L.level.width, l.kind === "ko" ? [] : dash);
    const word = l.kind === "ko" ? "KO" : "Cap";
    const text = l.edge === "top" ? `↑ ${word}` : l.edge === "bottom" ? `↓ ${word}` : word;
    tags.push({ y, text, colour });
  }
  if (f.path.length > 1) {
    c.save();
    c.beginPath();
    c.rect(p.x, p.y - L.line.width, p.w, p.h + L.line.width * HALF);
    c.clip();
    // A smooth line through the samples' midpoints (Fomo's spline), with its own fill fading to the plot's foot.
    const pts = f.path.map((q) => ({ x: X(q.x), y: Y(q.y) }));
    const first = pts[0] ?? { x: p.x, y: headY };
    const last = pts[pts.length - 1] ?? first;
    const trace = () => {
      c.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i];
        const n = pts[i + 1];
        if (a && n) c.quadraticCurveTo(a.x, a.y, (a.x + n.x) / HALF, (a.y + n.y) / HALF);
      }
      c.lineTo(last.x, last.y);
    };
    c.beginPath();
    trace();
    c.lineTo(last.x, p.y + p.h);
    c.lineTo(first.x, p.y + p.h);
    c.closePath();
    const g = c.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, tone);
    g.addColorStop(1, col.card);
    c.globalAlpha = L.line.fillAlpha;
    c.fillStyle = g;
    c.fill();
    c.globalAlpha = 1;
    c.beginPath();
    trace();
    c.strokeStyle = tone;
    c.lineWidth = L.line.width;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke();
    c.restore();
  }
  rule(c, [p.x, headY], [p.x + p.w, headY], tone, L.rule.width, [L.rule.on, L.rule.off], L.rule.alpha);
  disc(c, X(f.head.x), headY, L.head.halo, tone, L.head.haloAlpha);
  disc(c, X(f.head.x), headY, L.head.r, tone);
  if (pillMid !== headY) rule(c, [L.pill.x, headY], [L.pill.x, pillMid], tone, L.rule.width);
  roundBox(c, [L.pill.x, pillTop, L.pill.w, L.pill.h], L.pill.radius, tone);
  textAt(c, f.pillText, L.pill.x + L.pill.w / HALF, pillMid + PILL_NUDGE, bold(L.pill.size), col.pillInk, "center");
  // The price column: the pill, then the tags, then the labels — nothing drawn where it would meet a claimed box.
  const claim = columnClaims(pillTop, L.pill.h);
  for (const t of tags) {
    const base = Math.min(Math.max(t.y + LABEL_NUDGE, p.y + L.level.tagSize), p.y + p.h);
    if (claim(base, L.level.tagSize)) {
      textAt(c, t.text, L.labels.right, base, semibold(L.level.tagSize), t.colour, "right");
    }
  }
  f.labels.forEach((l, i) => {
    const base = Y(l.y) + LABEL_NUDGE;
    if (base - L.labels.size < p.y || base > p.y + p.h || !claim(base, L.labels.size)) return;
    textAt(c, f.labelTexts[i] ?? "", L.labels.right, base, regular(L.labels.size), col.muted, "right");
  });
  f.ticks.forEach((t, i) => {
    const s = f.tickTexts[i] ?? "";
    const half = width(c, s, regular(L.ticks.size)) / HALF;
    const x = X(t.x);
    if (x - half < p.x || x + half > p.x + p.w) return;
    textAt(c, s, x, L.ticks.base, regular(L.ticks.size), col.muted, "center");
  });

  // The moments: a disc on the line, and its tooltip in the empty future beside the head.
  f.moments.forEach((m, i) => {
    if (m.x < 0 || m.x > 1) return;
    const mx = X(m.x);
    const my = inPlot(Y(m.y));
    const out = m.kind === "out";
    const discColour = out ? tone : w.up === null ? col.range : w.up ? col.up : col.down;
    disc(c, mx, my, L.disc.r, discColour, m.alpha);
    const g = L.disc.glyph;
    if (out) roundBox(c, [mx - g, my - g, g * HALF, g * HALF], 0, col.pillInk, m.alpha);
    else triangle(c, mx, my, g * HALF, w.up !== false, col.pillInk, m.alpha);
    if (m.tipAlpha <= 0) return;
    const t = L.tip;
    const tx = L.tipText;
    const value = f.momentTexts[i] ?? "";
    const tw = Math.max(
      t.minW,
      width(c, m.title, semibold(tx.titleSize)) + t.padX * HALF,
      width(c, value, semibold(tx.valueSize)) + t.padX * HALF,
    );
    const left = Math.min(t.x, t.maxRight - tw);
    const top = Math.min(Math.max(my - t.above, t.top), t.bottom);
    roundBox(c, [left, top, tw, t.h], t.radius, col.panel, m.tipAlpha);
    textAt(c, m.title, left + tw / HALF, top + tx.titleBase, semibold(tx.titleSize), col.muted, "center", m.tipAlpha);
    textAt(c, value, left + tw / HALF, top + tx.valueBase, semibold(tx.valueSize), col.ink, "center", m.tipAlpha);
  });

  // The trade: one rule, then the market, the PnL with its ROI and three stats — centred.
  const sp = L.separator;
  rule(c, [sp.x, sp.y], [sp.x + sp.w, sp.y], col.rule, L.rule.width);
  const cx = sp.x + sp.w / HALF;
  const mk = L.market;
  const nameW = width(c, w.market, semibold(mk.nameSize));
  const tagW = width(c, w.tag, semibold(mk.tagSize));
  const rowLeft = cx - (mk.mark + mk.gap + nameW + mk.gap + tagW) / HALF;
  imageAt(c, img.mark, rowLeft, mk.markY, mk.mark, mk.mark / HALF);
  textAt(c, w.market, rowLeft + mk.mark + mk.gap, mk.nameBase, semibold(mk.nameSize), col.ink);
  textAt(c, w.tag, rowLeft + mk.mark + mk.gap + nameW + mk.gap, mk.nameBase, semibold(mk.tagSize), col.muted);
  const display = (size: number) => font(faces, WEIGHT.black, size, true);
  const [pnl, pnlFont] = fit(c, f.pnlText, display(L.pnl.size), display(L.pnl.min), L.pnl.maxW);
  const pnlW = width(c, pnl, pnlFont);
  const roiW = f.roiText ? L.pnl.gap + width(c, f.roiText, semibold(L.roi.size)) : 0;
  const x = cx - (pnlW + roiW) / HALF;
  textAt(c, pnl, x, L.pnl.base, pnlFont, tone);
  if (f.roiText) textAt(c, f.roiText, x + pnlW + L.pnl.gap, L.roi.base, semibold(L.roi.size), col.ink);
  const st = L.stats;
  w.stats.forEach(([label, value], i) => {
    const mid = st.x + i * st.column + st.column / HALF;
    textAt(c, label, mid, st.labelBase, regular(st.labelSize), col.muted, "center");
    // The exit's price is held back until the film reaches OUT.
    const shown = i === w.stats.length - 1 && !f.ended ? "—" : value;
    textAt(c, shown, mid, st.valueBase, semibold(st.valueSize), col.ink, "center");
  });

  // The band: the lockup, where to play, the QR to the trade.
  if (img.lockup) c.drawImage(img.lockup, L.lockup.x, L.lockup.y, L.lockup.w, L.lockup.h);
  const rf = L.referral;
  textAt(c, w.referralLabel, rf.x, rf.labelBase, regular(rf.labelSize), col.groundInk, "left", LABEL_ALPHA);
  const [code, codeFont] = fit(c, w.code, bold(rf.codeSize), bold(rf.codeMin), rf.maxW);
  textAt(c, code, rf.x, rf.codeBase, codeFont, col.groundInk);
  imageAt(c, img.qr, L.qr.x, L.qr.y, L.qr.size, L.qr.radius);
}
