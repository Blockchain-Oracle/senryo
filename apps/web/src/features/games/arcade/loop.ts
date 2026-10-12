"use client";
/**
 * The canvas as a surface and the loop that drives a run over it (R7.1; Owarine `useArcadeLoop.ts`). The run steps at
 * exactly 60 Hz whatever the display does: a frame's time goes into an accumulator, the engine steps while a whole
 * step is in it, and the draw gets the fraction left so it can interpolate. A stall (a long task) is clamped to a
 * tenth of a second so the run never lurches, and the loop stops while the page is hidden. The surface owns the
 * device-pixel ratio (capped at 2: past it nothing is sharper and a phone pays for it) and hands the draw the CSS box.
 */
import { STEP_MS } from "@senryo/core";
import { type RefObject, useEffect, useRef, useSyncExternalStore } from "react";

export interface ArcadeView {
  ctx: CanvasRenderingContext2D;
  /** The canvas box in CSS pixels, and the backing store's ratio to it. */
  w: number;
  h: number;
  dpr: number;
}

export interface LoopDriver {
  /** One fixed step. */
  step(): void;
  /** Paint the current state, `alpha` (0–1) of the way to the next. */
  draw(view: ArcadeView, alpha: number, nowMs: number): void;
}

const MAX_FRAME_MS = 100;
const MAX_DPR = 2;

/** Measures the canvas on mount and on every resize; `onReady` repaints an idle screen after each. */
export function useArcadeSurface(
  canvas: RefObject<HTMLCanvasElement | null>,
  onReady: (view: ArcadeView) => void,
): RefObject<ArcadeView | null> {
  const view = useRef<ArcadeView | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      el.width = Math.round(box.width * dpr);
      el.height = Math.round(box.height * dpr);
      view.current = { ctx, w: box.width, h: box.height, dpr };
      ready.current(view.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvas]);
  return view;
}

const subscribeVisible = (l: () => void) => {
  document.addEventListener("visibilitychange", l);
  return () => document.removeEventListener("visibilitychange", l);
};

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisible,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** Runs the driver while `running` and the page is visible. */
export function useArcadeLoop(
  driver: RefObject<LoopDriver | null>,
  view: RefObject<ArcadeView | null>,
  running: boolean,
): void {
  const visible = usePageVisible();
  useEffect(() => {
    if (!running || !visible) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const d = driver.current;
      acc += Math.min(MAX_FRAME_MS, now - last);
      last = now;
      if (d) {
        while (acc >= STEP_MS) {
          d.step();
          acc -= STEP_MS;
        }
        if (view.current) d.draw(view.current, acc / STEP_MS, now);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, visible, driver, view]);
}
