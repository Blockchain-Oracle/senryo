/**
 * Draws one frame of the replay film on a 2D canvas (Q3, D-350; Codex direction 17 §2; the phone's `drawFilm` with
 * Skia): the same 1080 × 1350 card from the same layout and the same frame data, so a video made on the web matches one
 * made on the phone. The preview and the exporter both call it; the exporter at t = i / 30 into an OffscreenCanvas.
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
const LINE_GAP = 4;
const MID = 0.5;
const STAMP_RULE_ALPHA = 0.5;
const HAIRLINE_ALPHA = 0.24;
const HALF_TURN_DEG = 180;
const DEG = Math.PI / HALF_TURN_DEG;
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

function imageAt(c: Ctx, img: CanvasImageSource | null, x: number, y: number, w: number, h: number, round: boolean) {
  if (!img) return;
  c.save();
  if (round) {
    c.beginPath();
    c.arc(x + w / HALF, y + h / HALF, w / HALF, 0, Math.PI * HALF);
    c.clip();
  }
  c.drawImage(img, x, y, w, h);
  c.restore();
}

function line(
  c: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  w: number,
  dash: number[] = [],
  alpha = 1,
) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = w;
  c.setLineDash(dash);
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.restore();
}

function drawStamp(c: Ctx, lines: readonly string[], col: FilmColours, faces: FilmFaces) {
  const s = L.stamp;
  c.save();
  c.translate(s.x + s.size / HALF, s.y + s.size / HALF);
  c.rotate(s.tiltDeg * DEG);
  const g = c.createLinearGradient(-s.size / HALF, -s.size / HALF, s.size / HALF, s.size / HALF);
  g.addColorStop(0, col.foilLight);
  g.addColorStop(1, col.foilDeep);
  c.fillStyle = g;
  c.fillRect(-s.size / HALF, -s.size / HALF, s.size, s.size);
  const inner = s.size - s.ring * HALF;
  c.fillStyle = col.lacquer;
  c.fillRect(-inner / HALF, -inner / HALF, inner, inner);
  const rule = s.size - s.rule * HALF;
  c.globalAlpha = STAMP_RULE_ALPHA;
  c.strokeStyle = col.foilHighlight;
  c.lineWidth = 1;
  c.strokeRect(-rule / HALF, -rule / HALF, rule, rule);
  c.globalAlpha = 1;
  const lineH = s.wordSize + LINE_GAP;
  const top = -((lines.length - 1) * lineH) / HALF + s.wordSize / HALF - LINE_GAP;
  lines.forEach((w, i) => {
    textAt(
      c,
      w.toUpperCase(),
      0,
      top + i * lineH,
      font(faces, WEIGHT.black, s.wordSize, true),
      col.foilHighlight,
      "center",
    );
  });
  c.restore();
}

function fit(c: Ctx, s: string, big: string, small: string, maxW: number, ellipsis: boolean): [string, string] {
  if (width(c, s, big) <= maxW) return [s, big];
  if (width(c, s, small) <= maxW || !ellipsis) return [s, small];
  let cut = s;
  while (cut.length > 1 && width(c, `${cut}…`, small) > maxW) cut = cut.slice(0, -1);
  return [`${cut}…`, small];
}

export function drawFilmFrame(
  c: Ctx,
  f: DrawnFrame,
  w: FilmWords,
  col: FilmColours,
  faces: FilmFaces,
  img: FilmImagesWeb,
) {
  const tone = f.tone === "up" ? col.up : f.tone === "down" ? col.down : col.ink;
  c.fillStyle = col.ground;
  c.fillRect(0, 0, L.frame.w, L.frame.h);
  c.fillStyle = col.card;
  c.beginPath();
  c.roundRect(L.card.x, L.card.y, L.card.w, L.card.h, L.card.radius);
  c.fill();

  imageAt(c, img.portrait, L.portrait.x, L.portrait.y, L.portrait.size, L.portrait.size, true);
  const [handle, handleFont] = fit(
    c,
    w.handle,
    font(faces, WEIGHT.semibold, L.handle.size),
    font(faces, WEIGHT.semibold, L.handle.min),
    L.handle.maxW,
    true,
  );
  textAt(c, handle, L.handle.x, L.handle.base, handleFont, col.ink);
  textAt(c, w.date, L.date.right, L.date.base, font(faces, WEIGHT.regular, L.date.size), col.muted, "right");
  textAt(c, w.mode, L.mode.right, L.mode.base, font(faces, WEIGHT.regular, L.mode.size), col.muted, "right");
  if (w.stamp) drawStamp(c, w.stamp, col, faces);

  const p = L.plot;
  const X = (x: number) => p.x + x * p.w;
  const Y = (y: number) => p.y + (1 - y) * p.h;
  c.save();
  c.globalAlpha = L.grid.alpha;
  c.fillStyle = col.ink;
  for (let gx = p.x; gx <= p.x + p.w; gx += L.grid.step) {
    for (let gy = p.y; gy <= p.y + p.h; gy += L.grid.step) {
      c.beginPath();
      c.arc(gx, gy, L.grid.dot, 0, Math.PI * HALF);
      c.fill();
    }
  }
  c.restore();
  const level = (kind: string) => f.levels.find((l) => l.kind === kind);
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
    c.save();
    c.globalAlpha = L.level.zoneAlpha;
    c.fillStyle = w.zone === "up" ? col.up : w.zone === "down" ? col.down : col.range;
    c.fillRect(p.x, Y(zone[0]), p.w, Y(zone[1]) - Y(zone[0]));
    c.restore();
  }
  const caption = font(faces, WEIGHT.regular, L.moment.captionSize);
  f.levels.forEach((l, i) => {
    const label = f.levelTexts[i] ?? "";
    const colour = l.kind === "ko" ? col.down : l.kind === "cap" ? col.up : col.muted;
    if (l.edge) {
      const base = l.edge === "top" ? p.y + L.level.labelSize : p.y + p.h - LINE_GAP;
      textAt(c, `${l.edge === "top" ? "↑" : "↓"} ${label}`, p.x, base, caption, colour);
      return;
    }
    if (l.kind === "low" || l.kind === "high") return;
    line(c, p.x, Y(l.y), p.x + p.w, Y(l.y), colour, L.level.width, l.kind === "ko" ? [] : [L.level.dash, L.level.dash]);
    textAt(c, label, p.x, Y(l.y) - LINE_GAP * HALF, caption, colour);
  });
  c.save();
  c.beginPath();
  c.rect(p.x, p.y - L.line.glow, p.w, p.h + L.line.glow * HALF);
  c.clip();
  if (f.path.length > 0) {
    for (const [lw, alpha] of [
      [L.line.glow, L.line.glowAlpha],
      [L.line.width, 1],
    ] as const) {
      c.save();
      c.globalAlpha = alpha;
      c.strokeStyle = tone;
      c.lineWidth = lw;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      f.path.forEach((q, i) => {
        if (i === 0) c.moveTo(X(q.x), Y(q.y));
        else c.lineTo(X(q.x), Y(q.y));
      });
      c.stroke();
      c.restore();
    }
  }
  for (const m of f.moments) {
    if (m.x < 0 || m.x > 1) continue;
    const mx = X(m.x);
    const my = Y(m.y);
    line(c, mx, my - L.moment.notch / HALF, mx, my + L.moment.notch / HALF, col.ink, L.moment.leader, [], m.alpha);
    const below = m.y > MID;
    const labelBase = below ? my + L.moment.notch + L.moment.labelSize : my - L.moment.notch;
    const cx = Math.min(Math.max(mx, p.x + L.moment.maxW / HALF), p.x + p.w - L.moment.maxW / HALF);
    textAt(c, m.label, cx, labelBase, font(faces, WEIGHT.black, L.moment.labelSize, true), col.ink, "center", m.alpha);
    if (m.captionAlpha > 0) {
      const capBase = below
        ? labelBase + L.moment.captionSize + L.moment.gap
        : labelBase - L.moment.labelSize - L.moment.gap;
      textAt(c, m.caption, cx, capBase, caption, col.muted, "center", m.captionAlpha);
    }
  }
  c.restore();
  const headY = Y(f.head.y);
  line(c, p.x, headY, p.x + p.w, headY, tone, L.rule.width, [L.rule.on, L.rule.off], L.rule.alpha);
  c.fillStyle = tone;
  c.beginPath();
  c.arc(X(f.head.x), headY, L.head.r, 0, Math.PI * HALF);
  c.fill();
  const pillTop = Math.min(L.pill.bottom, Math.max(L.pill.top, headY - L.pill.h / HALF));
  if (pillTop !== headY - L.pill.h / HALF)
    line(c, L.pill.x, headY, L.pill.x, pillTop + L.pill.h / HALF, tone, L.rule.width);
  c.fillStyle = tone;
  c.beginPath();
  c.roundRect(L.pill.x, pillTop, L.pill.w, L.pill.h, L.pill.radius);
  c.fill();
  const pillBase = pillTop + L.pill.h / HALF + L.pill.size / HALF - LINE_GAP * HALF;
  textAt(
    c,
    f.pillText,
    L.pill.x + L.pill.w / HALF,
    pillBase,
    font(faces, WEIGHT.bold, L.pill.size),
    col.pillInk,
    "center",
  );
  const small = font(faces, WEIGHT.regular, L.labels.size);
  f.labels.forEach((l, i) => {
    const ly = Y(l.y);
    if (Math.abs(ly - (pillTop + L.pill.h / HALF)) < L.labels.clear || ly < p.y || ly > p.y + p.h) return;
    textAt(c, f.labelTexts[i] ?? "", L.labels.right, ly + L.labels.size / HALF - LINE_GAP, small, col.muted, "right");
  });
  f.ticks.forEach((t, i) => {
    if (t.x >= 0 && t.x <= 1) textAt(c, f.tickTexts[i] ?? "", X(t.x), L.ticks.base, small, col.muted, "center");
  });
  if (f.provenanceText) {
    textAt(
      c,
      f.provenanceText,
      L.provenance.x,
      L.provenance.base,
      font(faces, WEIGHT.regular, L.provenance.size),
      col.muted,
    );
  }

  const pn = L.panel;
  line(c, pn.x, pn.y, pn.x + pn.w, pn.y, col.muted, 1, [], HAIRLINE_ALPHA);
  imageAt(c, img.mark, pn.x, L.market.markY, L.market.mark, L.market.mark, true);
  textAt(c, w.market, L.market.x, L.market.nameBase, font(faces, WEIGHT.semibold, L.market.nameSize), col.ink);
  const body = font(faces, WEIGHT.regular, L.market.idSize);
  textAt(c, w.identity, L.market.x, L.market.idBase, body, col.muted);
  textAt(c, w.figureLabel, pn.x, L.figure.base, font(faces, WEIGHT.regular, L.figure.size), col.muted);
  const [pnl, pnlFont] = fit(
    c,
    f.pnlText,
    font(faces, WEIGHT.black, L.pnl.size, true),
    font(faces, WEIGHT.black, L.pnl.min, true),
    L.pnl.maxW,
    false,
  );
  textAt(c, pnl, pn.x, L.pnl.base, pnlFont, tone);
  textAt(c, f.roiText, L.roi.x, L.roi.base, font(faces, WEIGHT.semibold, L.roi.size), col.ink);
  w.stats.forEach(([label, value], i) => {
    const x = pn.x + i * L.stats.column;
    textAt(c, label, x, L.stats.labelBase, body, col.muted);
    const shown = i === w.stats.length - 1 && !f.ended ? "—" : value;
    textAt(c, shown, x, L.stats.valueBase, font(faces, WEIGHT.semibold, L.stats.valueSize), col.ink);
  });

  imageAt(c, img.lockup, L.lockup.x, L.lockup.y, L.lockup.w, L.lockup.h, false);
  textAt(c, w.referralLabel, L.referral.x, L.referral.labelBase, body, col.muted);
  const [code, codeFont] = fit(
    c,
    w.code,
    font(faces, WEIGHT.semibold, L.referral.codeSize),
    font(faces, WEIGHT.semibold, L.referral.codeMin),
    L.referral.maxW,
    false,
  );
  textAt(c, code, L.referral.x, L.referral.codeBase, codeFont, col.ink);
  imageAt(c, img.qr, L.qr.x, L.qr.y, L.qr.size, L.qr.size, false);
}
