"use client";
/**
 * The live chart on the web (Owarine `LiveChart.tsx` on `@senryo/live`): a parallax dot field and the line, each its
 * own canvas at ≤ 2× device resolution, one animation loop. Every streamed tick goes straight to the engine and the
 * overlay is read from a ref each frame, so nothing here re-renders per tick (D-272). `onFrame` hands the head to the
 * reactions.
 */
import type { ChartOverlay } from "@senryo/calls";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { memo, type RefObject, useEffect, useRef } from "react";
import { ChartEngine, type ChartFrame } from "./chart-engine";
import { DotGrid } from "./dot-grid";
import { readChartTheme } from "./theme";

export interface LiveChartProps {
  symbol: string;
  /** The window's and the open call's overlay, written per tick by the quote pass. */
  overlay: RefObject<ChartOverlay | null>;
  /** Shown before the first tick ("Waiting for BTC…"). */
  waiting: string;
  /** Every frame's head (null while waiting): the reactions ride it. */
  onFrame?: RefObject<((frame: ChartFrame | null) => void) | null>;
  label: string;
}

export const LiveChart = memo(function LiveChart({ symbol, overlay, waiting, onFrame, label }: LiveChartProps) {
  const live = useLive();
  const boxRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;

  useEffect(() => {
    const box = boxRef.current;
    const dotsCanvas = dotsRef.current;
    const lineCanvas = lineRef.current;
    if (!box || !dotsCanvas || !lineCanvas) return;
    let theme = readChartTheme(box);
    const engine = new ChartEngine(lineCanvas, theme.chart, waitingRef.current);
    const dots = new DotGrid(dotsCanvas, theme.dots);
    engineRef.current = engine;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const resize = () => {
      engine.resize();
      dots.resize();
    };
    const loop = (now: number) => {
      engine.setOverlay(overlay.current);
      const frame = engine.frame(now, reduced.matches);
      dots.frame(frame, reduced.matches);
      onFrame?.current?.(frame);
      raf = requestAnimationFrame(loop);
    };
    resize();
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    const mo = new MutationObserver(() => {
      theme = readChartTheme(box);
      engine.setTheme(theme.chart);
      dots.setColour(theme.dots);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      engineRef.current = null;
    };
  }, [overlay, onFrame]);

  useEffect(() => {
    engineRef.current?.reset(waitingRef.current);
    const feed = () => {
      const tick = live.prices.latest(symbol);
      if (tick) engineRef.current?.setPrice(priceFromE8(tick.priceE8), performance.now());
    };
    feed();
    return live.prices.subscribe(symbol, feed);
  }, [live, symbol]);

  return (
    <div ref={boxRef} role="img" aria-label={label} className="relative h-full w-full overflow-hidden">
      <canvas ref={dotsRef} className="absolute inset-0 block h-full w-full" aria-hidden />
      <canvas ref={lineRef} className="absolute inset-0 block h-full w-full" aria-hidden />
    </div>
  );
});
