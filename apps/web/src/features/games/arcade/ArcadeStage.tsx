"use client";
/**
 * The arcade's stage (R7.1): a run takes the whole screen (the page asked for full screen on Play; this fixed layer
 * covers the viewport where the browser can't), counts 3-2-1-GO with its beeps, starts the game music, and plays at a
 * fixed 60 Hz. Hold anywhere — a pointer, Space or ↑ — and lean with the screen's halves or ← →. A practice run
 * pauses (the button, Esc, or leaving the page); a ranked run can't pause, and leaving the page ends it unranked. The
 * run's end is the engine's: then the game-over card, with the server's replay check for a ranked run.
 */
import type { ArcadeGame } from "@senryo/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fire, music, sound } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { readInk } from "./ink";
import { type LoopDriver, useArcadeLoop, useArcadeSurface, usePageVisible } from "./loop";
import type { ArcadeRun, RunInput } from "./run";
import { Countdown, OverPlate, PausePlate, type StageResult, StageTop } from "./StageParts";
import "./arcade.css";

type Phase = "loading" | "countdown" | "playing" | "paused" | "over";

const COUNT_MS = 600;
const COUNT_FROM = 3;
/** The wipeout plays out (shake, fragments) before the card. */
const OVER_DELAY_MS = 900;
const HUD_MS = 100;
const HINT_MS = 5_000;
const HOLD_KEYS = new Set([" ", "ArrowUp", "w", "W"]);
const BACK_KEYS = new Set(["ArrowLeft", "a", "A"]);
const FORWARD_KEYS = new Set(["ArrowRight", "d", "D"]);

export interface StageProps {
  game: ArcadeGame;
  title: string;
  hint: string;
  best: number | null;
  signedIn: boolean;
  /** Makes a run: a seed (the server's when signed in) and what it plays on. */
  prepare: (ink: ReturnType<typeof readInk>) => Promise<ArcadeRun>;
  /** A finished ranked run, checked by the server: its best, and the note for the card. */
  submit: (run: ArcadeRun) => Promise<{ best: number; note: string }>;
  share: (score: number) => void;
  /** Every finished run's score (the page keeps the session's best). */
  onFinished: (score: number) => void;
  onClose: () => void;
}

export function ArcadeStage(props: StageProps) {
  const { title, hint, best, signedIn, prepare, submit, share, onFinished, onClose } = props;
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<ArcadeRun | null>(null);
  const driver = useRef<LoopDriver | null>(null);
  const scoreEl = useRef<HTMLSpanElement>(null);
  const comboEl = useRef<HTMLSpanElement>(null);
  const lineEl = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [count, setCount] = useState(COUNT_FROM);
  const [result, setResult] = useState<StageResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [hinting, setHinting] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const finishRef = useRef<(r: ArcadeRun, left: boolean) => Promise<void>>(async () => undefined);

  const finish = useCallback(
    async (r: ArcadeRun, left: boolean) => {
      setPhase("over");
      const score = r.score();
      const isBest = !left && score > 0 && (best === null || score > best);
      const card = (note: string | null): StageResult => ({ score, isBest, note, stats: r.stats() });
      onFinished(score);
      if (isBest) fire("win", { cue: "win" });
      if (left) return setResult(card("You left the game, so this run isn't ranked."));
      if (!r.ranked) return setResult(card(signedIn ? "A practice run · not ranked" : null));
      setChecking(true);
      setResult(card(null));
      try {
        setResult(card((await submit(r)).note));
      } catch (error) {
        setResult(card("That run wasn't ranked."));
        notify({ title: "That run wasn't ranked", description: (error as Error).message, tone: "warning" });
      } finally {
        setChecking(false);
      }
    },
    [best, signedIn, submit, onFinished],
  );
  finishRef.current = finish;

  // Make the run, then count it in. `attempt` restarts it (Play again).
  useEffect(() => {
    let alive = true;
    setPhase("loading");
    setResult(null);
    setHinting(true);
    const el = root.current;
    if (!el) return;
    prepare(readInk(el)).then(
      (r) => {
        if (!alive) return;
        run.current = r;
        let overSeen = false;
        let lastHud = 0;
        let lastCombo = 1;
        driver.current = {
          step: () => {
            // The run moves only once it's GO; after the end, only a wipeout's last frames play out.
            const p = phaseRef.current;
            if (p !== "playing" && !(p === "over" && r.isOver())) return;
            r.step();
            if (r.isOver() && !overSeen) {
              overSeen = true;
              window.setTimeout(() => void finishRef.current(r, false), OVER_DELAY_MS);
            }
          },
          draw: (view, alpha, now) => {
            r.draw(view, alpha, now);
            if (now - lastHud < HUD_MS) return;
            lastHud = now;
            const hud = r.hud();
            if (scoreEl.current) scoreEl.current.textContent = hud.score.toLocaleString();
            if (lineEl.current) lineEl.current.textContent = hud.line ?? "";
            const combo = comboEl.current;
            if (combo && hud.combo !== lastCombo) {
              lastCombo = hud.combo ?? 1;
              combo.textContent = lastCombo > 1 ? `×${lastCombo}` : "";
              // Restart the pop.
              combo.style.animation = "none";
              void combo.offsetWidth;
              combo.style.animation = "";
            }
          },
        };
        setCount(COUNT_FROM);
        setPhase("countdown");
      },
      (error: Error) => {
        if (!alive) return;
        notify({ title: "The game can't start right now", description: error.message, tone: "warning" });
        onClose();
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  // 3-2-1-GO, then the music.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      sound("countGo");
      music("games");
      const t = window.setTimeout(() => setPhase("playing"), COUNT_MS);
      return () => window.clearTimeout(t);
    }
    sound("countBeep");
    const t = window.setTimeout(() => setCount((n) => n - 1), COUNT_MS);
    return () => window.clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = window.setTimeout(() => setHinting(false), HINT_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Leaving the page: a practice run pauses, a ranked one ends.
  useEffect(() => {
    const r = run.current;
    if (visible || phase !== "playing" || !r || r.isOver()) return;
    if (r.ranked) void finish(r, true);
    else setPhase("paused");
  }, [visible, phase, finish]);

  const view = useArcadeSurface(canvas, (v) => driver.current?.draw(v, 0, performance.now()));
  useArcadeLoop(driver, view, phase === "playing" || phase === "over" || phase === "countdown");

  // Input: pointers and keys fold into one hold and one lean.
  const pointers = useRef(new Map<number, -1 | 1>());
  const keys = useRef({ hold: false, lean: 0 as -1 | 0 | 1 });
  const push = useCallback(() => {
    const r = run.current;
    if (!r || phaseRef.current !== "playing") return r?.input({ hold: false, lean: 0 });
    const sides = [...pointers.current.values()];
    const next: RunInput = {
      hold: keys.current.hold || sides.length > 0,
      lean: keys.current.lean !== 0 ? keys.current.lean : (sides.at(-1) ?? 0),
    };
    r.input(next);
  }, []);
  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>, down: boolean) => {
    if (down) {
      const box = e.currentTarget.getBoundingClientRect();
      pointers.current.set(e.pointerId, e.clientX - box.left < box.width / 2 ? -1 : 1);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else pointers.current.delete(e.pointerId);
    push();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === "keydown";
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (down && phaseRef.current === "playing" && run.current && !run.current.ranked) setPhase("paused");
        return;
      }
      if (HOLD_KEYS.has(e.key)) keys.current.hold = down;
      else if (BACK_KEYS.has(e.key)) keys.current.lean = down ? -1 : 0;
      else if (FORWARD_KEYS.has(e.key)) keys.current.lean = down ? 1 : 0;
      else return;
      e.preventDefault();
      push();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [push]);
  useEffect(() => {
    if (phase !== "playing") {
      pointers.current.clear();
      keys.current = { hold: false, lean: 0 };
    }
    push();
  }, [phase, push]);

  // The page under the stage holds still; leaving the stage stops the music and full screen.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      music(null);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const exit = () => {
    fire("tick", { cue: "tap" });
    onClose();
  };
  const again = () => {
    fire("press", { cue: "tap" });
    setAttempt((n) => n + 1);
  };

  return createPortal(
    <div ref={root} className="arcade-stage" data-phase={phase}>
      <canvas
        ref={canvas}
        aria-label={`${title} · ${hint}`}
        onPointerDown={(e) => onPointer(e, true)}
        onPointerUp={(e) => onPointer(e, false)}
        onPointerCancel={(e) => onPointer(e, false)}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="arcade-hud flex flex-col justify-between">
        <StageTop
          score={scoreEl}
          combo={comboEl}
          best={best}
          canPause={phase === "playing" && run.current?.ranked === false}
          onPause={() => setPhase("paused")}
          onExit={exit}
        />
        <div className="flex flex-col items-start gap-1">
          {phase === "playing" && hinting ? <span className="arcade-hint text-body">{hint}</span> : null}
          <span className="arcade-dim text-meta">
            <span ref={lineEl} />
            {run.current ? (run.current.ranked ? " · Ranked run" : " · Practice run") : null}
          </span>
        </div>
      </div>
      {phase === "countdown" ? <Countdown n={count} /> : null}
      {phase === "paused" ? <PausePlate onResume={() => setPhase("playing")} onExit={exit} /> : null}
      {phase === "over" && result ? (
        <OverPlate
          title={title}
          result={result}
          checking={checking}
          signedIn={signedIn}
          onAgain={again}
          onShare={() => share(result.score)}
          onExit={exit}
        />
      ) : null}
    </div>,
    document.body,
  );
}
