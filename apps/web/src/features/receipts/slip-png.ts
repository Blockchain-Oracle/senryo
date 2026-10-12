/**
 * The trade slip as an image (D-331: Share and Save export the same slip; it replaces the S5.13 share card): drawn at
 * 3× — 1080 px wide, its height from its facts — on its own paper with the stamp at rest and a QR to the slip's page
 * in the stub. Fixed paper colours: it is an object, not a screen. The market mark and the QR arrive as images (the
 * page renders and serialises them).
 */
import type { TradeSlip } from "@senryo/calls";
import { KINPAKU, QR, RECEIPT } from "@senryo/tokens";

const W = 360;
const SCALE = 3;
const PAD = 20;
const GAP = 16;
const RADIUS = 12;
const MARK = 24;
const STAMP = 88;
const STAMP_RING = 3;
const STAMP_FIELD_RADIUS = 2;
const STAMP_RULE_INSET = 7;
const STAMP_TILT_DEG = -4;
const HALF_TURN_DEG = 180;
const PERF = 16;
const NOTCH = 8;
const DASH_ON = 4;
const DASH = [DASH_ON, DASH_ON] as const;
/** The dashed rule runs this far past the body's padding, towards the notches. */
const PERF_REACH = 4;
const STAMP_CORNER = 4;
const STAMP_WORDS_INSET = 4;
const TITLE_GAP = 10;
const LINK_DROP = 8;
/** A line of text sits on the mark's middle when its baseline is a third of its size below it. */
const BASELINE_SHARE = 3;
const QR_SIZE = 72;
/** The link's room: the slip's width less the QR and the padding either side of each. */
const LINK_ROOM = W - PAD * 2 - QR_SIZE - PAD;
const STUB_TOP = 8;
const STUB_BOTTOM = 18;
const FACT_LINE = 20;
const FACT_GAP = 8;
const FONT = { head: 11, title: 15, label: 11, figure: 48, when: 13, fact: 13, stub: 12, stamp: 15 } as const;
const STAMP_LINE = 17;
const HEAD_H = 14;
const LABEL_H = 14;
const WHEN_H = 28;
/** The time under the figure: its baseline this far below the figure's. */
const WHEN_DROP = 22;
const RESULT_H = LABEL_H + FONT.figure + WHEN_H;

export interface SlipAssets {
  mark: HTMLImageElement | null;
  qr: HTMLImageElement;
  /** Canvas font families: the app's Inter and its condensed display face. */
  sans: string;
  display: string;
}

const factsHeight = (n: number) => (n === 0 ? 0 : n * FACT_LINE + (n - 1) * FACT_GAP);

function drawStamp(ctx: CanvasRenderingContext2D, slip: TradeSlip, x: number, y: number, display: string) {
  if (!slip.stamp) return;
  ctx.save();
  ctx.translate(x + STAMP / 2, y + STAMP / 2);
  ctx.rotate((STAMP_TILT_DEG * Math.PI) / HALF_TURN_DEG);
  const half = STAMP / 2;
  const foil = ctx.createLinearGradient(-half, -half, half, half);
  const stops = [KINPAKU.foilHighlight, KINPAKU.foilLight, KINPAKU.foilMid, KINPAKU.foilShade, KINPAKU.foilDeep];
  for (const [i, c] of stops.entries()) foil.addColorStop(i / (stops.length - 1), c);
  ctx.fillStyle = foil;
  ctx.beginPath();
  ctx.roundRect(-half, -half, STAMP, STAMP, STAMP_CORNER);
  ctx.fill();
  ctx.fillStyle = KINPAKU.lacquer;
  ctx.beginPath();
  ctx.roundRect(
    -half + STAMP_RING,
    -half + STAMP_RING,
    STAMP - STAMP_RING * 2,
    STAMP - STAMP_RING * 2,
    STAMP_FIELD_RADIUS,
  );
  ctx.fill();
  ctx.strokeStyle = KINPAKU.foilShade;
  ctx.lineWidth = 1;
  const r = half - STAMP_RULE_INSET;
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = KINPAKU.foilHighlight;
  ctx.font = `800 ${FONT.stamp}px ${display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = slip.stamp.lines.map((l) => l.toUpperCase());
  const top = -((lines.length - 1) * STAMP_LINE) / 2;
  for (const [i, l] of lines.entries())
    ctx.fillText(l, 0, top + i * STAMP_LINE, STAMP - STAMP_RULE_INSET * 2 - STAMP_WORDS_INSET);
  ctx.restore();
}

/** Draws the slip; returns it as a PNG. */
export function drawSlip(slip: TradeSlip, a: SlipAssets): Promise<Blob> {
  const bodyH =
    PAD + HEAD_H + GAP + MARK + GAP + Math.max(RESULT_H, STAMP) + GAP + factsHeight(slip.facts.length) + PAD;
  const stubH = STUB_TOP + QR_SIZE + STUB_BOTTOM;
  const H = bodyH + PERF + stubH;
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas 2d unavailable"));
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = RECEIPT.paper;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, RADIUS);
  ctx.fill();

  let y = PAD;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = RECEIPT.ink;
  ctx.font = `800 ${FONT.head}px ${a.display}`;
  ctx.textAlign = "left";
  ctx.fillText("SENRYO", PAD, y + FONT.head);
  ctx.fillStyle = RECEIPT.muted;
  ctx.font = `500 ${FONT.head}px ${a.sans}`;
  ctx.textAlign = "right";
  ctx.fillText(slip.folio, W - PAD, y + FONT.head);
  y += HEAD_H + GAP;

  if (a.mark) ctx.drawImage(a.mark, PAD, y, MARK, MARK);
  ctx.fillStyle = RECEIPT.ink;
  ctx.font = `600 ${FONT.title}px ${a.sans}`;
  ctx.textAlign = "left";
  ctx.fillText(slip.title, PAD + MARK + TITLE_GAP, y + MARK / 2 + FONT.title / BASELINE_SHARE);
  y += MARK + GAP;

  ctx.fillStyle = RECEIPT.muted;
  ctx.font = `500 ${FONT.label}px ${a.sans}`;
  ctx.fillText(slip.figure.label.toUpperCase(), PAD, y + FONT.label);
  ctx.fillStyle = slip.figure.tone === "up" ? RECEIPT.up : slip.figure.tone === "down" ? RECEIPT.down : RECEIPT.ink;
  ctx.font = `800 ${FONT.figure}px ${a.display}`;
  ctx.fillText(slip.figure.text, PAD, y + LABEL_H + FONT.figure);
  ctx.fillStyle = RECEIPT.muted;
  ctx.font = `400 ${FONT.when}px ${a.sans}`;
  ctx.fillText(slip.when ?? "Open", PAD, y + LABEL_H + FONT.figure + WHEN_DROP);
  drawStamp(ctx, slip, W - PAD - STAMP, y, a.display);
  y += Math.max(RESULT_H, STAMP) + GAP;

  ctx.font = `400 ${FONT.fact}px ${a.sans}`;
  for (const f of slip.facts) {
    ctx.fillStyle = RECEIPT.muted;
    ctx.textAlign = "left";
    ctx.fillText(f.k, PAD, y + FONT.fact);
    ctx.fillStyle = RECEIPT.ink;
    ctx.font = `600 ${FONT.fact}px ${a.sans}`;
    ctx.textAlign = "right";
    ctx.fillText(f.v, W - PAD, y + FONT.fact);
    ctx.font = `400 ${FONT.fact}px ${a.sans}`;
    y += FACT_LINE + FACT_GAP;
  }
  y = bodyH;

  // The perforation: a dashed rule and a notch cut from each side.
  ctx.strokeStyle = RECEIPT.rule;
  ctx.setLineDash([...DASH]);
  ctx.beginPath();
  ctx.moveTo(PAD - PERF_REACH, y + PERF / 2);
  ctx.lineTo(W - PAD + PERF_REACH, y + PERF / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const x of [0, W]) {
    ctx.beginPath();
    ctx.arc(x, y + PERF / 2, NOTCH, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  y += PERF + STUB_TOP;

  ctx.fillStyle = RECEIPT.muted;
  ctx.font = `500 ${FONT.stub}px ${a.sans}`;
  ctx.textAlign = "left";
  ctx.fillText(slip.mode, PAD, y + FONT.stub);
  ctx.fillText(slip.url.replace(/^https?:\/\//, ""), PAD, y + FONT.stub * 2 + LINK_DROP, LINK_ROOM);
  ctx.fillStyle = QR.paper;
  ctx.fillRect(W - PAD - QR_SIZE, y, QR_SIZE, QR_SIZE);
  ctx.drawImage(a.qr, W - PAD - QR_SIZE, y, QR_SIZE, QR_SIZE);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the slip"))), "image/png"),
  );
}

/** An SVG element (an EntityMark rendered off-screen) as an image the canvas can draw. */
export function svgImage(svg: SVGElement | null): Promise<HTMLImageElement | null> {
  if (!svg) return Promise.resolve(null);
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function imageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image"));
    img.src = src;
  });
}
