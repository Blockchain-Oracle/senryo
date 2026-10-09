/**
 * A call's share card on the web (the phone's `ShareCard`, 4 : 5, drawn at 3× = 1080 × 1350): the welcome sky, a
 * tilted paper card with the market and side, the result huge in its colour, entry → exit and the mode, 千両 in the
 * corner, then the seal, SENRYO, the line and the link with its QR. Fixed paper colours in either theme: it is an
 * image, not a screen. The mark, the seal and the QR arrive as images (the page renders and serialises them).
 */
import type { ShareCall } from "@senryo/calls";
import { LIGHT, QR, WELCOME } from "@senryo/tokens";

export const CARD_W = 360;
export const CARD_H = 450;
const SCALE = 3;
const PAD = 22;
const RADIUS = 28;
const TILT_DEG = -3;
const HALF_TURN_DEG = 180;
const DEG = Math.PI / HALF_TURN_DEG;
const MARK = 40;
const SEAL = 44;
const SEAL_INSET = 6;
const SEAL_PLATE = SEAL + SEAL_INSET * 2;
const SEAL_RADIUS = 12;
const QR_SIZE = 76;
const QR_PAD = 6;
const GAP = 12;
const CHARM_H = 236;
const DETAIL_ALPHA = 0.65;
const KANJI_ALPHA = 0.12;
const FONT = { call: 26, result: 64, detail: 15, caption: 12, brand: 22, kanji: 40 } as const;
const LINE = { result: 70, detail: 21, caption: 16 } as const;

export interface CardAssets {
  mark: HTMLImageElement | null;
  seal: HTMLImageElement | null;
  qr: HTMLImageElement;
  /** Canvas font families (the app's Inter and Noto Sans JP). */
  sans: string;
  jp: string;
  up: string;
  down: string;
  action: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Draws the card; returns it as a PNG. */
export function drawShareCard(card: ShareCall, a: CardAssets): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas 2d unavailable"));
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = WELCOME.sky;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The charm: a paper card tilted 3°.
  const cw = CARD_W - PAD * 2;
  ctx.save();
  ctx.translate(PAD + cw / 2, PAD + CHARM_H / 2);
  ctx.rotate(TILT_DEG * DEG);
  ctx.translate(-cw / 2, -CHARM_H / 2);
  roundRect(ctx, 0, 0, cw, CHARM_H, RADIUS, LIGHT.card);
  const ink = LIGHT.foreground;
  let y = PAD;
  if (a.mark) ctx.drawImage(a.mark, PAD, y, MARK, MARK);
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  ctx.font = `900 ${FONT.call}px ${a.sans}`;
  ctx.fillText(card.call.toUpperCase(), PAD + MARK + GAP, y + MARK / 2, cw - PAD * 2 - MARK - GAP);
  y += MARK + GAP;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${FONT.result}px ${a.sans}`;
  ctx.fillStyle = card.won ? a.up : a.down;
  ctx.fillText(card.result, PAD, y + FONT.result, cw - PAD * 2);
  y += LINE.result + GAP / 2;
  ctx.fillStyle = ink;
  ctx.globalAlpha = DETAIL_ALPHA;
  ctx.font = `500 ${FONT.detail}px ${a.sans}`;
  for (const line of [card.entry ? `Entry ${card.entry}` : null, card.exit ? `${card.exitLabel} ${card.exit}` : null]) {
    if (!line) continue;
    ctx.fillText(line, PAD, y + FONT.detail);
    y += LINE.detail;
  }
  ctx.font = `500 ${FONT.caption}px ${a.sans}`;
  ctx.fillText(card.mode, PAD, y + FONT.caption);
  ctx.globalAlpha = KANJI_ALPHA;
  ctx.font = `900 ${FONT.kanji}px ${a.jp}`;
  ctx.textAlign = "right";
  ctx.fillText("千両", cw - PAD, CHARM_H - PAD / 2);
  ctx.restore();

  // The foot: seal, SENRYO and the link, the QR.
  const footY = CARD_H - PAD - SEAL_PLATE;
  roundRect(ctx, PAD, footY, SEAL_PLATE, SEAL_PLATE, SEAL_RADIUS, a.action);
  if (a.seal) ctx.drawImage(a.seal, PAD + (SEAL_PLATE - SEAL) / 2, footY + (SEAL_PLATE - SEAL) / 2, SEAL, SEAL);
  const textX = PAD + SEAL_PLATE + GAP;
  const qrBox = QR_SIZE + QR_PAD * 2;
  const qrX = CARD_W - PAD - qrBox;
  const qrY = CARD_H - PAD - qrBox;
  ctx.fillStyle = WELCOME.ink;
  ctx.textAlign = "left";
  ctx.font = `900 ${FONT.brand}px ${a.sans}`;
  ctx.fillText("SENRYO", textX, footY + FONT.brand - 2);
  ctx.font = `500 ${FONT.caption}px ${a.sans}`;
  ctx.fillText("Call the next move.", textX, footY + FONT.brand + LINE.caption);
  ctx.fillText(card.url.replace(/^https?:\/\//, ""), textX, footY + FONT.brand + LINE.caption * 2, qrX - textX - GAP);
  roundRect(ctx, qrX, qrY, qrBox, qrBox, SEAL_RADIUS, QR.paper);
  ctx.drawImage(a.qr, qrX + QR_PAD, qrY + QR_PAD, QR_SIZE, QR_SIZE);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the card"))), "image/png"),
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
