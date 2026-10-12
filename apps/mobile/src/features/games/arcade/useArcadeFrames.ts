/**
 * The web's arcade loop on the phone (R7.6; Owarine `useArcadeFrames.ts`): the run steps at exactly 60 Hz on the JS
 * thread whatever the display does (an accumulator, stalls clamped to a tenth of a second), and each frame records a
 * Skia picture through the 2D shim — the shared draw interpolated by the leftover fraction — that the stage's
 * `<Picture>` shows from a shared value. The loop stops while the app is in the background.
 */
import type { LoopDriver } from "@senryo/arcade";
import { STEP_MS } from "@senryo/core";
import type { SkPicture } from "@shopify/react-native-skia";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { SkiaCtx } from "./skia-2d";

const MAX_FRAME_MS = 100;

export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setActive(s === "active"));
    return () => sub.remove();
  }, []);
  return active;
}

/** Runs the driver while `running` and the app is in front; returns the picture to show. `runKey` names the run. */
export function useArcadeFrames(
  driver: RefObject<LoopDriver | null>,
  runKey: number,
  size: { w: number; h: number },
  running: boolean,
): SharedValue<SkPicture> {
  const ctx = useMemo(() => new SkiaCtx(), []);
  // An empty first picture, so the canvas always has one to show.
  const empty = useMemo(() => {
    ctx.begin(1, 1);
    return ctx.finish();
  }, [ctx]);
  const picture = useSharedValue<SkPicture>(empty);
  const active = useAppActive();
  const { w, h } = size;
  useEffect(() => {
    const d = driver.current;
    if (!d || w === 0 || h === 0) return;
    const paint = (alpha: number, now: number) => {
      ctx.begin(w, h);
      d.draw({ ctx, w, h, dpr: 1 }, alpha, now);
      picture.value = ctx.finish();
    };
    paint(0, performance.now());
    if (!running || !active) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      acc += Math.min(MAX_FRAME_MS, now - last);
      last = now;
      while (acc >= STEP_MS) {
        d.step();
        acc -= STEP_MS;
      }
      paint(acc / STEP_MS, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [driver, runKey, ctx, picture, w, h, running, active]);

  return picture;
}
