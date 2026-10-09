/**
 * What every chart frame draws with, made once (S5 gate: ≤ 2 ms a frame). Each native call costs on the UI thread, so
 * the frame never resets a paint: one fill and one stroke paint come pre-set and a draw only sets colour and alpha;
 * the eraser and the dashed level paint are their own; text metrics are read once per font; the dot field is one
 * picture per size, drawn translated. Measured on the simulator's dev build before this: 4.1 ms a frame (axis 1.8,
 * line 1.4, dots 0.37).
 */
import type { ChartLevel } from "@senryo/calls";
import {
  BlendMode,
  PaintStyle,
  type SkCanvas,
  type SkColor,
  type SkFont,
  Skia,
  type SkPaint,
  type SkPicture,
  StrokeCap,
  StrokeJoin,
} from "@shopify/react-native-skia";
import { DOT_SPACING } from "./state";

const HALF = 2;
const DOT_R = 1.1;
const DOT_ALPHA = 0.14;
/** An SkColor is RGBA floats; alpha is the fourth. */
const ALPHA = 3;

export interface DrawKit {
  paints: { fill: SkPaint; stroke: SkPaint; eraser: SkPaint; level: SkPaint; tick: SkPaint };
  fonts: { axis: SkFont; pill: SkFont; pillSmall: SkFont; tag: SkFont; mark: SkFont | null };
  /** Baseline offset that centres each font's text on a y (−(ascent + descent) / 2), read once. */
  mids: { axis: number; tag: number };
  colors: {
    up: SkColor;
    down: SkColor;
    ink: SkColor;
    inverse: SkColor;
    helper: SkColor;
    /** The helper colour at zero alpha: the ticks' edge fade interpolates to it, not to transparent black. */
    helperClear: SkColor;
    onLine: SkColor;
  };
  dash: Record<ChartLevel["kind"], ReturnType<typeof Skia.PathEffect.MakeDash>>;
  /** The fade's erasing gradient stops (opaque → clear). */
  fade: { solid: SkColor; mid: SkColor; clear: SkColor };
  mark: string;
  /** The value reads in points (a basket), not dollars. */
  points: boolean;
}

const mid = (font: SkFont) => {
  const m = font.getMetrics();
  return -(m.ascent + m.descent) / HALF;
};

export function makeKit(
  fonts: DrawKit["fonts"],
  colors: Omit<DrawKit["colors"], "helperClear">,
  dash: DrawKit["dash"],
  fade: DrawKit["fade"],
  mark: string,
  points: boolean,
): DrawKit {
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setStyle(PaintStyle.Fill);
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeCap(StrokeCap.Round);
  stroke.setStrokeJoin(StrokeJoin.Round);
  const level = Skia.Paint();
  level.setAntiAlias(true);
  level.setStyle(PaintStyle.Stroke);
  level.setStrokeWidth(1);
  const tick = Skia.Paint();
  tick.setAntiAlias(true);
  tick.setStyle(PaintStyle.Stroke);
  tick.setStrokeWidth(1);
  const eraser = Skia.Paint();
  eraser.setStyle(PaintStyle.Fill);
  eraser.setBlendMode(BlendMode.DstOut);
  const helperClear = new Float32Array(colors.helper);
  helperClear[ALPHA] = 0;
  return {
    paints: { fill, stroke, eraser, level, tick },
    fonts,
    mids: { axis: mid(fonts.axis), tag: mid(fonts.tag) },
    colors: { ...colors, helperClear },
    dash,
    fade,
    mark,
    points,
  };
}

export function fill(k: DrawKit, color: SkColor, alpha = 1): SkPaint {
  "worklet";
  const p = k.paints.fill;
  p.setColor(color);
  p.setAlphaf(alpha);
  return p;
}

export function stroke(k: DrawKit, color: SkColor, width: number, alpha = 1): SkPaint {
  "worklet";
  const p = k.paints.stroke;
  p.setColor(color);
  p.setAlphaf(alpha);
  p.setStrokeWidth(width);
  return p;
}

/** Text right-aligned at `right`, centred on `midY` by the font's cached offset. */
export function textRight(
  c: SkCanvas,
  k: DrawKit,
  text: string,
  right: number,
  midY: number,
  font: SkFont,
  centre: number,
  color: SkColor,
  alpha: number,
) {
  "worklet";
  c.drawText(text, right - font.getTextWidth(text), midY + centre, fill(k, color, alpha), font);
}

/** The dot field for a size, one spacing larger on every side so it can be drawn shifted by its scroll. */
export function makeDotPicture(k: DrawKit, w: number, h: number): SkPicture | null {
  "worklet";
  if (w <= 0 || h <= 0) return null;
  const recorder = Skia.PictureRecorder();
  const c = recorder.beginRecording(Skia.XYWHRect(0, 0, w + DOT_SPACING * HALF, h + DOT_SPACING * HALF));
  const p = fill(k, k.colors.ink, DOT_ALPHA);
  for (let x = 0; x < w + DOT_SPACING * HALF; x += DOT_SPACING)
    for (let y = 0; y < h + DOT_SPACING * HALF; y += DOT_SPACING) c.drawCircle(x, y, DOT_R, p);
  return recorder.finishRecordingAsPicture();
}
