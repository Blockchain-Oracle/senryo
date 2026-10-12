/**
 * Line Rider v2 on the web (R7.2): a sled run as the stage's driver. Each fixed step turns the held input into the
 * sled's code, records it (the trace the server replays), steps the shared engine, and turns its events into the
 * feel: a scrape grain and sparks while pressing into the line, a puff on the hop, a thud, dust, 30 ms of hit-stop and
 * a 4 px shake on a hard landing, a rising note per clean landing and per gap cleared, a flip's surge, the milestone
 * ladder, and on the wipeout an 8 px shake, a flash, fragments and the music cut. All of it is view-only: the engine's
 * state is never touched.
 */
import {
  createRng,
  createSledState,
  recordRideInput,
  SLED,
  type SledState,
  STEP_HZ,
  sledCode,
  sledOpenAt,
  sledScoreOf,
  stepSled,
  tapeIndexAt,
} from "@senryo/core";
import { fire, music, sound } from "@/lib/feedback";
import type { ArcadeInk } from "./ink";
import type { ArcadeView } from "./loop";
import { type ArcadeRun, clockOf, type RunInput } from "./run";
import { drawSled } from "./sled-draw";

export interface SledTape {
  symbol: string;
  /** The first close's minute (unix seconds) and price × 1e8. */
  from: number;
  open: number;
  moves: readonly number[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface FloatText {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

/** Everything the draw reads: the engine's state, the step before it, and the view's own effects. */
export interface SledScene {
  s: SledState;
  prev: { bx: number; by: number; fx: number; fy: number; rx: number; ry: number };
  ink: ArcadeInk;
  tape: SledTape;
  particles: Particle[];
  texts: FloatText[];
  trail: { x: number; y: number }[];
  shake: number;
  flash: number;
  camY: number;
}

export const FX = {
  trail: 120,
  hitStopTicks: 2,
  hardLanding: 260,
  landAirSec: 0.15,
  landShake: 4,
  crashShake: 8,
  flipShake: 3,
  shakeKeep: 0.85,
  flashKeep: 0.9,
  scrapeTicks: 7,
  scrapeSpeed: 120,
  gravity: 600,
  dust: 10,
  dustHard: 18,
  sparks: 2,
  crashBits: 28,
  flipBits: 16,
  textTicks: 54,
  textRise: 0.5,
  bitLife: 40,
  sparkLife: 18,
  sparkSpeed: 140,
  dustSpeed: 90,
  burstSpeed: 260,
  bitSize: 3,
  sparkSize: 1.6,
  textLift: 30,
} as const;

const E8 = 1e8;
const MOVE_UNITS = 1e5;
const MS = 1000;
const SEC_PER_MIN = 60;
const HALF = 0.5;
const TWO = 2;
const MILESTONE_BASE = 2;
const PRICE_DIGITS = 2;
const FLIP_WORDS: Readonly<Record<number, string>> = { 1: "FLIP", 2: "DOUBLE FLIP", 3: "TRIPLE FLIP" };

const rand = (spread: number) => (Math.random() * TWO - 1) * spread;

export function createSledRun(o: {
  seed: string;
  ranked: boolean;
  calm: boolean;
  tape: SledTape;
  ink: ArcadeInk;
}): ArcadeRun {
  const rng = createRng(o.seed);
  const config = { calm: o.calm, tape: o.tape.moves };
  const s = createSledState(rng, config);
  const trace: number[] = [];
  let input: RunInput = { hold: false, lean: 0 };
  const scene: SledScene = {
    s,
    prev: { bx: s.b.x, by: s.b.y, fx: s.f.x, fy: s.f.y, rx: s.r.x, ry: s.r.y },
    ink: o.ink,
    tape: o.tape,
    particles: [],
    texts: [],
    trail: [],
    shake: 0,
    flash: 0,
    camY: 0,
  };
  // The HUD's price: the tape's closes rebuilt from its moves, once.
  const prices: number[] = [];
  let p = o.tape.open / E8;
  for (const m of o.tape.moves) {
    p *= 1 + m / MOVE_UNITS;
    prices.push(p);
  }
  const money = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: PRICE_DIGITS,
  });
  const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  let hitStop = 0;
  let airTicks = 0;
  let overGap = false;
  let gaps = 0;
  let bestCombo = 1;
  let scrapeIn = 0;
  let lastFlips = 0;

  const burst = (x: number, y: number, n: number, speed: number, color: string, life: number, size: number) => {
    for (let i = 0; i < n; i++) {
      scene.particles.push({ x, y, vx: rand(speed), vy: -Math.random() * speed, life, max: life, color, size });
    }
  };
  const say = (text: string, color: string) => {
    scene.texts.push({ text, x: s.r.x, y: s.r.y - FX.textLift, life: FX.textTicks, color });
  };

  const onLand = (comboBefore: number) => {
    const air = airTicks / STEP_HZ;
    airTicks = 0;
    const mx = (s.b.x + s.f.x) * HALF;
    const my = (s.b.y + s.f.y) * HALF;
    if (overGap) {
      overGap = false;
      gaps += 1;
      fire("snap", { ladder: ["gap", gaps - 1] });
      say("GAP CLEARED", o.ink.up);
    }
    if (air < FX.landAirSec) return;
    if (s.landed >= FX.hardLanding) {
      hitStop = FX.hitStopTicks;
      scene.shake = Math.max(scene.shake, FX.landShake);
      fire("impact", { cue: "landing" });
      burst(mx, my, FX.dustHard, FX.dustSpeed, o.ink.ink, FX.bitLife, FX.bitSize);
    } else {
      sound("landing");
      burst(mx, my, FX.dust, FX.dustSpeed, o.ink.ink, FX.bitLife, FX.bitSize);
    }
    if (s.combo > comboBefore) {
      bestCombo = Math.max(bestCombo, s.combo);
      fire("tick", { ladder: ["comboStep", Math.round((s.combo - 1) / SLED.comboStep) - 1] });
      say(`CLEAN ×${s.combo}`, o.ink.range);
    }
  };

  const onCrash = () => {
    scene.shake = FX.crashShake;
    scene.flash = 1;
    burst(s.r.x, s.r.y, FX.crashBits, FX.burstSpeed, o.ink.down, FX.bitLife, FX.bitSize);
    burst(s.r.x, s.r.y, FX.crashBits / TWO, FX.burstSpeed, o.ink.ink, FX.bitLife, FX.bitSize);
    fire("fail", { cue: "crash" });
    music(null);
  };

  const tickFx = () => {
    scene.shake *= FX.shakeKeep;
    scene.flash *= FX.flashKeep;
    const dt = 1 / STEP_HZ;
    scene.particles = scene.particles.filter((q) => {
      q.vy += FX.gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= 1;
      return q.life > 0;
    });
    scene.texts = scene.texts.filter((t) => {
      t.y -= FX.textRise;
      t.life -= 1;
      return t.life > 0;
    });
  };

  const step = () => {
    if (s.over) return tickFx();
    if (hitStop > 0) {
      hitStop -= 1;
      return;
    }
    const pv = scene.prev;
    pv.bx = s.b.x;
    pv.by = s.b.y;
    pv.fx = s.f.x;
    pv.fy = s.f.y;
    pv.rx = s.r.x;
    pv.ry = s.r.y;
    const code = sledCode(input.hold, input.lean);
    const hopping = s.held && !input.hold && s.grounded && s.heldTicks >= SLED.hopMinTicks;
    const comboBefore = s.combo;
    recordRideInput(trace, s.tick, code);
    stepSled(s, code, rng, config);
    if (s.over) return onCrash();
    if (hopping) {
      fire("press", { cue: "wing" });
      burst(s.b.x, s.b.y, FX.dust, FX.dustSpeed, o.ink.ink, FX.sparkLife, FX.sparkSize);
    }
    if (!s.grounded) {
      airTicks += 1;
      if (sledOpenAt(s, (s.b.x + s.f.x) * HALF)) overGap = true;
    }
    if (s.landed) onLand(comboBefore);
    if (s.flipped) {
      const n = s.flips - lastFlips;
      say(FLIP_WORDS[n] ?? `${n}× FLIP`, o.ink.accent);
      fire("surge", { cue: "surge" });
      scene.shake = Math.max(scene.shake, FX.flipShake);
      burst(s.r.x, s.r.y, FX.flipBits, FX.burstSpeed, o.ink.accent, FX.bitLife, FX.bitSize);
    }
    lastFlips = s.flips;
    if (s.milestoneHit) {
      fire("confirm", { ladder: ["milestone", s.milestoneHit - MILESTONE_BASE] });
      say(`×${s.milestoneHit} COMBO`, o.ink.up);
    }
    // Pressing into the line throws sparks off the back runner and scrapes.
    if (s.grounded && input.hold && s.speed > FX.scrapeSpeed) {
      for (let i = 0; i < FX.sparks; i++) {
        scene.particles.push({
          x: s.b.x,
          y: s.b.y,
          vx: -Math.random() * FX.sparkSpeed,
          vy: -Math.random() * FX.sparkSpeed * HALF,
          life: FX.sparkLife,
          max: FX.sparkLife,
          color: o.ink.up,
          size: FX.sparkSize,
        });
      }
      scrapeIn -= 1;
      if (scrapeIn <= 0) {
        sound("scrape");
        scrapeIn = FX.scrapeTicks;
      }
    }
    scene.trail.push({ x: s.b.x, y: s.b.y });
    if (scene.trail.length > FX.trail) scene.trail.shift();
    tickFx();
  };

  const at = () => tapeIndexAt((s.b.x + s.f.x) * HALF, prices.length);
  return {
    seed: o.seed,
    ranked: o.ranked,
    calm: o.calm,
    step,
    draw: (view: ArcadeView, alpha: number) => drawSled(view, scene, alpha),
    isOver: () => s.over,
    score: () => sledScoreOf(s),
    ticks: () => s.tick,
    trace: () => trace,
    input: (next) => {
      input = next;
    },
    hud: () => {
      const i = at();
      const price = prices[i];
      const when = clock.format((o.tape.from + (i + 1) * SEC_PER_MIN) * MS);
      return {
        score: sledScoreOf(s),
        combo: s.combo,
        line: price === undefined ? o.tape.symbol : `${o.tape.symbol} ${money.format(price)} · ${when}`,
      };
    },
    stats: () => [
      { label: "Time", value: clockOf(s.elapsedSec) },
      { label: "Flips", value: String(s.flips) },
      { label: "Best combo", value: `×${bestCombo}` },
      { label: "Gaps cleared", value: String(gaps) },
    ],
  };
}
