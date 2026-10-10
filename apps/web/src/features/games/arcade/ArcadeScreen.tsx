"use client";
/**
 * Line Rider and Candle Hop on the web (S8.8, D-295; Owarine's arcade): the shared engines stepped at a fixed 60 Hz
 * under a requestAnimationFrame loop (drawn between steps), inputs recorded by tick — the ride's wheel as one byte when
 * it changes, the hop's presses — and, signed in, the run sent with the server's seed to be replayed before it ranks.
 * Reduced motion plays the calmer ramp, and the board says which runs took it. No money rides on a score.
 */
import {
  type ArcadeGame,
  createFlapState,
  createRideState,
  createRng,
  type FlapState,
  qFromTarget,
  type RideState,
  recordRideInput,
  rideScoreOf,
  STEP_MS,
  seedFromBytes,
  shortAddress,
  stepFlap,
  stepRide,
  ticksToMs,
} from "@senryo/core";
import { useArcadeBoard, useArcadeDesk } from "@senryo/query";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { drawFlap, drawRide, readInk } from "./draw";

const FIELD_ASPECT = "16 / 9";
const CANVAS_W = 1280;
const CANVAS_H = 720;
const SEED_BYTES = 4;
/** A frame that stalls (a background tab) steps at most this many ticks on return. */
const MAX_CATCH_UP = 8;
const KEY_STEP = 0.06;

type Phase = "ready" | "playing" | "over";

interface Run {
  seed: string;
  ranked: boolean;
  state: RideState | FlapState;
  rng: ReturnType<typeof createRng>;
  trace: number[];
  target: number;
  pressed: boolean;
}

export function ArcadeScreen({ game, title, how }: { game: ArcadeGame; title: string; how: string }) {
  const account = useAccount();
  const signedIn = Boolean(account.hint && account.client);
  const reduce = useReducedMotion() ?? false;
  const desk = useArcadeDesk(game);
  const board = useArcadeBoard(game);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<Run | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<{ score: number; best: number | null; ranked: boolean } | null>(null);
  const isRide = game === "line-rider";

  const finish = useCallback(
    async (r: Run) => {
      const score = isRide ? rideScoreOf(r.state as RideState) : (r.state as FlapState).score;
      setPhase("over");
      fire(score > 0 ? "filled" : "fail");
      if (!r.ranked) return setResult({ score, best: null, ranked: false });
      try {
        const checked = await desk.score.mutateAsync({
          seed: r.seed,
          calm: reduce,
          durationMs: ticksToMs(r.state.tick),
          trace: r.trace,
          score,
        });
        setResult({ score, best: checked.best, ranked: true });
      } catch (error) {
        setResult({ score, best: null, ranked: false });
        notify({ title: "That run wasn't ranked", description: (error as Error).message, tone: "warning" });
      }
    },
    [desk.score, isRide, reduce],
  );

  const start = async () => {
    fire("tick", { cue: "tap" });
    let seed = seedFromBytes(crypto.getRandomValues(new Uint8Array(SEED_BYTES)));
    let ranked = false;
    if (signedIn) {
      try {
        seed = (await desk.seed.mutateAsync()).seed;
        ranked = true;
      } catch {
        ranked = false;
      }
    }
    const rng = createRng(seed);
    const config = { calm: reduce };
    run.current = {
      seed,
      ranked,
      rng,
      state: isRide ? createRideState(rng, config) : createFlapState(rng, config),
      trace: [],
      target: 1 / 2,
      pressed: false,
    };
    setResult(null);
    setPhase("playing");
  };

  // The loop: fixed 60 Hz steps, drawn between them.
  useEffect(() => {
    if (phase !== "playing") return;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const ink = readInk(el);
    const config = { calm: reduce };
    let last = performance.now();
    let acc = 0;
    let frame = 0;
    const tick = (now: number) => {
      const r = run.current;
      if (!r) return;
      acc = Math.min(acc + (now - last), STEP_MS * MAX_CATCH_UP);
      last = now;
      while (acc >= STEP_MS && !r.state.over) {
        if (isRide) {
          const q = qFromTarget(r.target);
          recordRideInput(r.trace, r.state.tick, q);
          stepRide(r.state as RideState, q, r.rng, config);
        } else {
          const flap = r.pressed;
          if (flap) r.trace.push(r.state.tick);
          r.pressed = false;
          stepFlap(r.state as FlapState, flap, r.rng, config);
        }
        acc -= STEP_MS;
      }
      const alpha = acc / STEP_MS;
      if (isRide) drawRide(ctx, r.state as RideState, ink, alpha);
      else drawFlap(ctx, r.state as FlapState, ink, alpha);
      if (r.state.over) {
        void finish(r);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, isRide, reduce, finish]);

  // Inputs: the ride follows the pointer's height (and ↑ ↓); the hop flaps on a press (and Space / ↑).
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = run.current;
    if (!r || !isRide) return;
    const box = e.currentTarget.getBoundingClientRect();
    r.target = 1 - (e.clientY - box.top) / box.height;
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing") return;
    if (isRide) onPointerMove(e);
    else if (run.current) run.current.pressed = true;
  };
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const r = run.current;
      if (!r) return;
      if (isRide && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        r.target = Math.max(0, Math.min(1, r.target + (e.key === "ArrowUp" ? KEY_STEP : -KEY_STEP)));
        e.preventDefault();
      } else if (!isRide && (e.key === " " || e.key === "ArrowUp")) {
        r.pressed = true;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, isRide]);

  const players = "value" in board ? board.value.players : [];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label={title} className="flex flex-col gap-4">
        <p className="text-body text-text-2">{how}</p>
        <div className="relative overflow-hidden rounded-2xl bg-card">
          <canvas
            ref={canvas}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ aspectRatio: FIELD_ASPECT }}
            className="block w-full touch-none"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
            aria-label={`${title} field`}
          />
          {phase !== "playing" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/80 p-4 text-center">
              {result ? (
                <>
                  <span className="tnum font-semibold text-page-title">{result.score}</span>
                  {signedIn || result.ranked ? (
                    <span className="text-meta text-text-2">
                      {result.ranked
                        ? `Checked by replay · your best ${result.best ?? result.score}`
                        : "Not ranked this time"}
                    </span>
                  ) : (
                    <SignInPrompt line="Sign in to rank your runs." compact />
                  )}
                </>
              ) : (
                <span className="font-semibold text-section-title">{title}</span>
              )}
              <button
                type="button"
                onClick={() => void start()}
                className="h-14 rounded-xl bg-primary px-8 font-semibold text-button text-primary-foreground transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {result ? "Play again" : "Play"}
              </button>
            </div>
          ) : null}
        </div>
        <p className="text-meta text-text-3">
          Scores are replayed by the server before they rank · checked, not on chain · no money rides on them
          {reduce ? " · reduced motion plays the calmer ramp" : ""}
        </p>
      </section>
      <section aria-label="Board" className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-semibold text-section-title">Board</h2>
        {board.status === "failed" ? (
          <p className="text-body text-text-2">The board can't be read right now · it retries on its own</p>
        ) : players.length === 0 ? (
          <p className="text-body text-text-2">
            {board.status === "unknown" ? "Reading the board…" : "No ranked runs yet."}
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {players.map((p, i) => (
              <li key={p.owner} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-row-title">
                  {i + 1}. {p.handle ? `@${p.handle}` : shortAddress(p.owner)}
                  {p.calm ? " · calm" : ""}
                </span>
                <span className="tnum font-semibold text-row-title">{p.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
