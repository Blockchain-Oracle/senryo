"use client";
/**
 * The live chart on the web (Owarine `LiveChart.tsx` on `@senryo/live`): a parallax dot field and the line, each its
 * own canvas at ≤ 2× device resolution, one animation loop. Every streamed tick goes straight to the engine and the
 * overlay is read from a ref each frame, so nothing here re-renders per tick (D-272). `onFrame` hands the head to the
 * reactions.
 */
import type { ChartOverlay, SessionHistory } from "@senryo/calls";
import { unitOf } from "@senryo/calls";
import { priceFromE8 } from "@senryo/core";
import { fillLine } from "@senryo/live";
import { useLive } from "@senryo/live/react";
import { memo, type RefObject, useEffect, useRef } from "react";
import { ChartEngine, type ChartFrame, type ChartHealth, LIVE } from "./chart-engine";
import { RESEED_WINDOW_MS, SAMPLE_CAPACITY, SAMPLE_MS } from "./constants";
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
  /** The price's health, read each frame: not live → the line freezes, dims and shows its age (R1.20). */
  health?: RefObject<ChartHealth | null>;
  /** A closed market's last session, read each frame: drawn whole on its own scale. */
  history?: RefObject<SessionHistory | null>;
  label: string;
}

export const LiveChart = memo(function LiveChart({
  symbol,
  overlay,
  waiting,
  onFrame,
  health,
  history,
  label,
}: LiveChartProps) {
  const live = useLive();
  const boxRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  useEffect(() => {
    const box = boxRef.current;
    const dotsCanvas = dotsRef.current;
    const lineCanvas = lineRef.current;
    if (!box || !dotsCanvas || !lineCanvas) return;
    let theme = readChartTheme(box);
    const engine = new ChartEngine(lineCanvas, theme.chart, waitingRef.current);
    engine.setUnit(unitOf(symbolRef.current));
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
      engine.setHealth(health?.current ?? LIVE);
      engine.setHistory(history?.current ?? null);
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
  }, [overlay, onFrame, health, history]);

  // A new market opens on its last ~10 s of real history when the client holds it (04-pricing R15); on a cold start that
  // history may land just after the first tick, and within the first second the line is redrawn from it.
  useEffect(() => {
    engineRef.current?.reset(waitingRef.current);
    engineRef.current?.setUnit(unitOf(symbol));
    let firstAt = 0;
    const history = () => {
      const h = live.prices.history(symbol);
      return fillLine(h.t, h.p, Date.now(), SAMPLE_CAPACITY, SAMPLE_MS)?.map(priceFromE8) ?? null;
    };
    const feed = () => {
      const tick = live.prices.latest(symbol);
      if (!tick) return;
      const now = performance.now();
      const first = firstAt === 0;
      if (first) firstAt = now;
      engineRef.current?.setPrice(priceFromE8(tick.priceE8), now, first ? history() : null);
    };
    feed();
    let active = true;
    void live
      .loadHistory(symbol)
      .then(() => {
        if (!active || firstAt === 0 || performance.now() - firstAt > RESEED_WINDOW_MS) return;
        engineRef.current?.reset(waitingRef.current);
        firstAt = 0;
        feed();
      })
      .catch(() => {});
    const off = live.prices.subscribe(symbol, feed);
    return () => {
      active = false;
      off();
    };
  }, [live, symbol]);

  return (
    <div ref={boxRef} role="img" aria-label={label} className="relative h-full w-full overflow-hidden">
      <canvas ref={dotsRef} className="absolute inset-0 block h-full w-full" aria-hidden />
      <canvas ref={lineRef} className="absolute inset-0 block h-full w-full" aria-hidden />
    </div>
  );
});
