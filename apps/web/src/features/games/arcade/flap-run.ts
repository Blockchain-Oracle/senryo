/**
 * Candle Hop on the stage (S8.8; R7.3 rebuilds it as a coin through a candle canyon): a hop run as the stage's driver.
 * A press is a flap (recorded by tick for the replay); the engine's events sound — the wing on a flap, a rising note per
 * candle passed, the crash with a shake and a flash. The 640×360 field is letterboxed into the stage.
 */
import { createFlapState, createRng, FIELD_H, FIELD_W, FLAP, type FlapState, STEP_HZ, stepFlap } from "@senryo/core";
import { fire, music, sound } from "@/lib/feedback";
import { type ArcadeInk, tint } from "./ink";
import type { ArcadeView } from "./loop";
import { type ArcadeRun, clockOf } from "./run";

const LOOK = {
  wickW: 2,
  bodyRadius: 4,
  coin: 11,
  coinGlow: 16,
  crashShake: 8,
  shakeKeep: 0.85,
  flashKeep: 0.9,
  flashAlpha: 0.35,
  flashFloor: 0.02,
} as const;

const HALF = 0.5;
const TWO = 2;
const FULL_TURN = Math.PI * TWO;

export function createFlapRun(o: {
  seed: string;
  ranked: boolean;
  calm: boolean;
  tape: readonly number[];
  ink: ArcadeInk;
}): ArcadeRun {
  const rng = createRng(o.seed);
  const config = { calm: o.calm, tape: o.tape };
  const s: FlapState = createFlapState(rng, config);
  const trace: number[] = [];
  let pressed = false;
  let held = false;
  let shake = 0;
  let flash = 0;
  let streak = 0;

  const step = () => {
    shake *= LOOK.shakeKeep;
    flash *= LOOK.flashKeep;
    if (s.over) return;
    const flap = pressed;
    pressed = false;
    if (flap) {
      trace.push(s.tick);
      if (!s.dying) fire("tick", { cue: "wing" });
    }
    stepFlap(s, flap, rng, config);
    if (s.scored) {
      fire("snap", { ladder: ["gap", streak] });
      streak += 1;
    }
    if (s.crashed) {
      shake = LOOK.crashShake;
      flash = 1;
      fire("fail", { cue: "crash" });
      music(null);
    } else if (s.impact) sound("landing");
  };

  const draw = (view: ArcadeView, alpha: number) => {
    const { ctx, w, h, dpr } = view;
    const ink = o.ink;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = ink.arena;
    ctx.fillRect(0, 0, w, h);
    const k = Math.min(w / FIELD_W, h / FIELD_H);
    const ox = (w - FIELD_W * k) * HALF + (Math.random() * TWO - 1) * shake;
    const oy = (h - FIELD_H * k) * HALF + (Math.random() * TWO - 1) * shake;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    sky.addColorStop(0, ink.raised);
    sky.addColorStop(1, ink.arena);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const shift = (s.worldX - s.worldXPrev) * (1 - alpha);
    for (const c of s.candles) {
      const x = c.x + shift;
      const top = (c.center - c.half) * FIELD_H;
      const bottom = (c.center + c.half) * FIELD_H;
      ctx.fillStyle = ink.down;
      ctx.fillRect(x - LOOK.wickW * HALF, top - FLAP.wick, LOOK.wickW, FLAP.wick);
      ctx.beginPath();
      ctx.roundRect(x - FLAP.bodyW * HALF, 0, FLAP.bodyW, top - FLAP.wick, LOOK.bodyRadius);
      ctx.fill();
      ctx.fillStyle = ink.up;
      ctx.fillRect(x - LOOK.wickW * HALF, bottom, LOOK.wickW, FLAP.wick);
      ctx.beginPath();
      ctx.roundRect(
        x - FLAP.bodyW * HALF,
        bottom + FLAP.wick,
        FLAP.bodyW,
        FIELD_H - bottom - FLAP.wick,
        LOOK.bodyRadius,
      );
      ctx.fill();
    }
    const y = (s.birdYPrev + (s.birdY - s.birdYPrev) * alpha) * FIELD_H;
    ctx.shadowBlur = LOOK.coinGlow;
    ctx.shadowColor = ink.accent;
    ctx.fillStyle = s.dying ? ink.down : ink.accent;
    ctx.beginPath();
    ctx.arc(FLAP.birdX + s.birdOffsetX, y, LOOK.coin, 0, FULL_TURN);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (flash > LOOK.flashFloor) {
      ctx.fillStyle = tint(ink.down, flash * LOOK.flashAlpha);
      ctx.fillRect(0, 0, w, h);
    }
  };

  return {
    seed: o.seed,
    ranked: o.ranked,
    calm: o.calm,
    step,
    draw,
    isOver: () => s.over,
    score: () => s.score,
    ticks: () => s.tick,
    trace: () => trace,
    input: (next) => {
      if (next.hold && !held) pressed = true;
      held = next.hold;
    },
    hud: () => ({ score: s.score, combo: null, line: null }),
    stats: () => [
      { label: "Time", value: clockOf(s.tick / STEP_HZ) },
      { label: "Candles", value: String(s.score) },
    ],
  };
}
