/**
 * The replay's soundtrack (Q3, D-350, D-352): the live terminal's price sounds played over the film, so a replay
 * sounds like the trade did — and only those: no music (the owner: the sounds of it going up and down, "not the sound
 * as in music"). The reaction engine is fed the recorded path in market time with the trade on it, exactly as the
 * terminal feeds it every tick: a favourable step climbs the profit ladder, a second step against plays the adverse
 * blip, a surge or mega move its flourish and a slump the down one; then the open, close and verdict cues. Market time
 * maps onto film time (pitch never changes). Steps share 160 ms buckets where the strongest wins, and flourishes keep
 * 800 ms apart and replace the steps beside them, so a compressed minute reads as a climb rather than a buzz (Codex
 * direction 18 §D).
 */
import { FILM_LAND_MS, FILM_LEAD_MS, type Film, filmTimeAt } from "./film.ts";
import { ReactionEngine } from "./reactions.ts";

const BPS = 10_000;
/** The ladder's top step and the adverse blip's second step (the terminal's `useReactions`). */
const LADDER_TOP = 10;
const ADVERSE_FROM = 2;
const BUCKET_MS = 160;
const FLOURISH_GAP_MS = 800;
/** The verdict follows the close by this much. */
const VERDICT_AFTER_MS = 240;

export type FilmCue = "open" | "profit" | "adverse" | "surge" | "mega" | "slump" | "close" | "win" | "loss" | "refund";

export interface FilmSound {
  /** Film time (ms), the cue, and its ladder step (the profit ladder only). */
  cues: { at: number; cue: FilmCue; step: number }[];
}

const strength = (c: { cue: FilmCue; step: number }) => (c.cue === "profit" ? 1 + c.step : 0);

export function filmSound(f: Film): FilmSound {
  const cues: FilmSound["cues"] = [{ at: FILM_LEAD_MS, cue: "open", step: 0 }];
  const engine = new ReactionEngine(() => 0);
  const { cost, up, moments, levels, exit, verdict } = f.input;
  const side = up === false ? -1 : 1;
  const entry = moments.find((m) => m.kind === "in")?.price ?? 0;
  const line = levels.find((l) => l.kind === "line" || l.kind === "ko")?.price ?? null;
  const end = exit ? f.runMs - FILM_LAND_MS : f.runMs;
  const steps = new Map<number, { at: number; cue: FilmCue; step: number }>();
  const flourishes: { at: number; cue: FilmCue; step: number }[] = [];
  for (let i = 0; i < f.times.length; i++) {
    const ms = f.times[i] ?? 0;
    const at = filmTimeAt(f, ms);
    if (at > end) break;
    const pnl = f.pnls[i] ?? null;
    const roi = ms >= f.fillMs && pnl !== null && cost !== null && cost > 0 ? (pnl / cost) * BPS : null;
    const position = roi === null ? null : { key: "film", side: side as 1 | -1, pnl: roi, margin: BPS, entry, line };
    for (const r of engine.feed({ t: ms, price: f.prices[i] ?? 0, position })) {
      if (r.kind === "surge") {
        const last = flourishes.at(-1);
        if (!last || at - last.at >= FLOURISH_GAP_MS) {
          flourishes.push({ at, cue: r.favorable ? (r.mega ? "mega" : "surge") : "slump", step: 0 });
        }
      } else if (r.kind === "step" && (r.favorable || r.count >= ADVERSE_FROM)) {
        const cue = r.favorable
          ? { at, cue: "profit" as const, step: Math.min(LADDER_TOP, r.count - 1) }
          : { at, cue: "adverse" as const, step: 0 };
        const bucket = Math.floor(at / BUCKET_MS);
        const held = steps.get(bucket);
        // The strongest in a bucket wins: a ladder step over a blip, a higher step over a lower one.
        if (!held || strength(cue) > strength(held)) steps.set(bucket, cue);
      }
    }
  }
  // A flourish replaces the steps beside it.
  for (const step of steps.values()) {
    if (!flourishes.some((x) => Math.abs(x.at - step.at) < BUCKET_MS)) cues.push(step);
  }
  cues.push(...flourishes);
  if (exit) {
    cues.push({ at: end, cue: "close", step: 0 });
    if (verdict) cues.push({ at: end + VERDICT_AFTER_MS, cue: verdict, step: 0 });
  }
  return { cues: cues.sort((a, b) => a.at - b.at) };
}
