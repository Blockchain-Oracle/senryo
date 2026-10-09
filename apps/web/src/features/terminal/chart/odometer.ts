/**
 * Rolling digits on a canvas (Tradash's `CanvasOdometer`, via Owarine): every digit position, counted from the right,
 * rolls to its new digit — up when the value rose, down when it fell — while `$ , . + −` stay still.
 */
import { DIGIT_EASE, DIGIT_SNAP, ROLL_EPSILON, SAMPLE_MS } from "./constants";
import { rollFrame, rollTarget } from "./engine";

interface Slot {
  cur: number;
  target: number;
}

const CLIP_PAD = 4;
const isDigit = (c: string) => c >= "0" && c <= "9";
const easeFor = (perSample: number, dtMs: number) => 1 - (1 - perSample) ** (Math.max(0, dtMs) / SAMPLE_MS);

export class CanvasOdometer {
  private text = "";
  private value = Number.NaN;
  private slots: Slot[] = [];

  /** Sets the shown text; `value` gives the roll direction (a rise rolls up). */
  set(text: string, value: number): void {
    if (text === this.text) return;
    const direction: 1 | -1 | 0 =
      Number.isFinite(this.value) && Number.isFinite(value)
        ? value > this.value
          ? 1
          : value < this.value
            ? -1
            : 0
        : 0;
    const digits = [...text].reverse();
    const prevDigits = [...this.text].reverse();
    this.slots = digits.map((c, i) => {
      if (!isDigit(c)) return { cur: 0, target: 0 };
      const d = Number(c);
      const old = this.slots[i];
      const prev = prevDigits[i];
      if (!old || prev === undefined || !isDigit(prev)) return { cur: d, target: d };
      return { cur: old.cur, target: rollTarget(old.target, Number(prev), d, direction) };
    });
    this.text = text;
    this.value = value;
  }

  /** Forgets the roll state (a call opened or ended: the result row starts fresh). */
  reset(): void {
    this.text = "";
    this.value = Number.NaN;
    this.slots = [];
  }

  step(dtMs: number): void {
    const k = easeFor(DIGIT_EASE, dtMs);
    for (const s of this.slots) {
      const d = s.target - s.cur;
      s.cur = Math.abs(d) < DIGIT_SNAP ? s.target : s.cur + d * k;
    }
  }

  get current(): string {
    return this.text;
  }

  /** Right-aligned at `right`, centred on `y`, clipped to `[clipTop, clipBottom]`; `pitch` is the roll distance. */
  draw(
    ctx: CanvasRenderingContext2D,
    right: number,
    y: number,
    pitch: number,
    clipTop: number,
    clipBottom: number,
  ): void {
    const chars = [...this.text].reverse();
    const width = ctx.measureText(this.text).width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(right - width - CLIP_PAD, clipTop, width + CLIP_PAD * 2, clipBottom - clipTop);
    ctx.clip();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    let x = right;
    chars.forEach((c, i) => {
      if (!isDigit(c)) ctx.fillText(c, x, y);
      else {
        const { digit, next, frac } = rollFrame(this.slots[i]?.cur ?? Number(c));
        if (frac < ROLL_EPSILON) ctx.fillText(String(digit), x, y);
        else {
          ctx.fillText(String(digit), x, y - frac * pitch);
          ctx.fillText(String(next), x, y + (1 - frac) * pitch);
        }
      }
      x -= ctx.measureText(c).width;
    });
    ctx.restore();
  }
}
