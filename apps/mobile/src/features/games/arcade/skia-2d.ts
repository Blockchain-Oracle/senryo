/**
 * The arcade's 2D canvas on the phone (R7.6): `@senryo/arcade`'s `Ctx2D` over a Skia picture recorder, so the web's
 * own drawing code (the sled's line, the coin's canyon) paints the phone frame for frame. Each frame records a picture
 * (`begin` → the draw → `finish`) that the stage shows in a Skia `<Picture>`. Only what the draws use: fills, strokes
 * and their glow (a blurred pass under the shape, as the canvas's `shadowBlur`), linear and radial gradients, paths,
 * rects, round rects, arcs, text, and a scale-and-translate transform. Units are points (Skia handles the density).
 */
import type { Ctx2D, Gradient2D } from "@senryo/arcade";
import {
  BlurStyle,
  matchFont,
  PaintStyle,
  type SkCanvas,
  type SkColor,
  type SkFont,
  Skia,
  type SkPaint,
  type SkPath,
  type SkPicture,
  StrokeCap,
  StrokeJoin,
  TileMode,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

const FAMILY = Platform.select({ ios: "Helvetica Neue", default: "sans-serif-condensed" });
const HALF_TURN_DEG = 180;
const DEG_PER_RAD = HALF_TURN_DEG / Math.PI;
const FULL_TURN = Math.PI * 2;
const BLUR_PER_SHADOW = 0.5;
const BOLD_FROM = 600;
/** Where a baseline sits relative to the text's size (the canvas's `textBaseline`). */
const BASELINE = { alphabetic: 0, bottom: -0.2, hanging: 0.8, ideographic: -0.2, middle: 0.35, top: 0.8 } as const;
const FONT_RE = /(\d+)\s+([\d.]+)px/;
const DEFAULT_SIZE = 12;
const DEFAULT_WEIGHT = 400;

class Gradient implements Gradient2D {
  readonly stops: { offset: number; color: string }[] = [];
  constructor(readonly make: (colors: SkColor[], pos: number[]) => ReturnType<typeof Skia.Shader.MakeLinearGradient>) {}
  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color });
  }
}

const colors = new Map<string, SkColor>();
function colorOf(c: string): SkColor {
  let hit = colors.get(c);
  if (!hit) {
    hit = Skia.Color(c);
    colors.set(c, hit);
  }
  return hit;
}

const fonts = new Map<string, SkFont>();
function fontOf(spec: string): SkFont {
  let hit = fonts.get(spec);
  if (!hit) {
    const m = FONT_RE.exec(spec);
    const weight = m ? Number(m[1]) : DEFAULT_WEIGHT;
    const size = m ? Number(m[2]) : DEFAULT_SIZE;
    hit = matchFont({ fontFamily: FAMILY, fontSize: size, fontWeight: weight >= BOLD_FROM ? "bold" : "normal" });
    fonts.set(spec, hit);
  }
  return hit;
}

export class SkiaCtx implements Ctx2D {
  fillStyle: string | Gradient2D = "black";
  strokeStyle: string | Gradient2D = "black";
  lineWidth = 1;
  lineCap: Ctx2D["lineCap"] = "butt";
  lineJoin: Ctx2D["lineJoin"] = "miter";
  shadowBlur = 0;
  shadowColor = "transparent";
  font = "400 12px sans-serif";
  textAlign: Ctx2D["textAlign"] = "left";
  textBaseline: Ctx2D["textBaseline"] = "alphabetic";
  private readonly recorder = Skia.PictureRecorder();
  private canvas: SkCanvas | null = null;
  private path: SkPath = Skia.Path.Make();
  private readonly paint: SkPaint = Skia.Paint();
  private readonly glow: SkPaint = Skia.Paint();
  private base = 0;

  /** Starts a frame of `w` × `h` points. */
  begin(w: number, h: number): void {
    this.canvas = this.recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
    this.base = this.canvas.save();
    this.paint.setAntiAlias(true);
    this.glow.setAntiAlias(true);
  }

  /** Ends the frame as a picture for the stage's `<Picture>`. */
  finish(): SkPicture {
    this.canvas = null;
    return this.recorder.finishRecordingAsPicture();
  }

  private get c(): SkCanvas {
    if (!this.canvas) throw new Error("SkiaCtx: draw outside begin/finish");
    return this.canvas;
  }

  setTransform(a: number, _b: number, _c: number, d: number, e: number, f: number): void {
    this.c.restoreToCount(this.base);
    this.base = this.c.save();
    this.c.translate(e, f);
    this.c.scale(a, d);
  }
  save(): void {
    this.c.save();
  }
  restore(): void {
    this.c.restore();
  }
  translate(x: number, y: number): void {
    this.c.translate(x, y);
  }
  scale(x: number, y: number): void {
    this.c.scale(x, y);
  }

  beginPath(): void {
    this.path = Skia.Path.Make();
  }
  moveTo(x: number, y: number): void {
    this.path.moveTo(x, y);
  }
  lineTo(x: number, y: number): void {
    this.path.lineTo(x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.path.quadTo(cpx, cpy, x, y);
  }
  arc(x: number, y: number, r: number, start: number, end: number): void {
    const sweep = end - start;
    if (Math.abs(sweep) >= FULL_TURN) this.path.addCircle(x, y, r);
    else this.path.addArc(Skia.XYWHRect(x - r, y - r, r * 2, r * 2), start * DEG_PER_RAD, sweep * DEG_PER_RAD);
  }
  roundRect(x: number, y: number, w: number, h: number, radius: number): void {
    this.path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), radius, radius));
  }

  fill(): void {
    this.drawWith(PaintStyle.Fill, this.fillStyle, (p) => this.c.drawPath(this.path, p));
  }
  stroke(): void {
    this.drawWith(PaintStyle.Stroke, this.strokeStyle, (p) => this.c.drawPath(this.path, p));
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const rect = Skia.XYWHRect(x, y, w, h);
    this.drawWith(PaintStyle.Fill, this.fillStyle, (p) => this.c.drawRect(rect, p));
  }
  fillText(text: string, x: number, y: number): void {
    const font = fontOf(this.font);
    const size = font.getSize();
    const width = this.textAlign === "left" || this.textAlign === "start" ? 0 : font.measureText(text).width;
    const dx =
      this.textAlign === "center" ? -width / 2 : this.textAlign === "right" || this.textAlign === "end" ? -width : 0;
    const dy = BASELINE[this.textBaseline] * size;
    this.drawWith(PaintStyle.Fill, this.fillStyle, (p) => this.c.drawText(text, x + dx, y + dy, p, font));
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient2D {
    return new Gradient((c, pos) =>
      Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, c, pos, TileMode.Clamp),
    );
  }
  createRadialGradient(_x0: number, _y0: number, _r0: number, x1: number, y1: number, r1: number): Gradient2D {
    return new Gradient((c, pos) => Skia.Shader.MakeRadialGradient({ x: x1, y: y1 }, r1, c, pos, TileMode.Clamp));
  }

  /** One shape: its glow first (a blurred pass in the shadow's colour), then the shape in its style. */
  private drawWith(style: PaintStyle, ink: string | Gradient2D, draw: (p: SkPaint) => void): void {
    for (const p of [this.glow, this.paint]) {
      p.setStyle(style);
      p.setStrokeWidth(this.lineWidth);
      p.setStrokeCap(
        this.lineCap === "round" ? StrokeCap.Round : this.lineCap === "square" ? StrokeCap.Square : StrokeCap.Butt,
      );
      p.setStrokeJoin(
        this.lineJoin === "round" ? StrokeJoin.Round : this.lineJoin === "bevel" ? StrokeJoin.Bevel : StrokeJoin.Miter,
      );
    }
    if (this.shadowBlur > 0 && this.shadowColor !== "transparent") {
      this.glow.setShader(null);
      this.glow.setColor(colorOf(this.shadowColor));
      this.glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, this.shadowBlur * BLUR_PER_SHADOW, true));
      draw(this.glow);
    }
    if (typeof ink === "string") {
      this.paint.setShader(null);
      this.paint.setColor(colorOf(ink));
    } else {
      const g = ink as Gradient;
      this.paint.setColor(colorOf("black"));
      this.paint.setShader(
        g.make(
          g.stops.map((s) => colorOf(s.color)),
          g.stops.map((s) => s.offset),
        ),
      );
    }
    draw(this.paint);
  }
}
