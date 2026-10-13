"use client";
import { candlesRoute } from "@senryo/api-client";
/**
 * The live chart on the web (Owarine `LiveChart.tsx` on `@senryo/live`): a parallax dot field and the line, each its
 * own canvas at ≤ 2× device resolution, one animation loop. Every streamed tick goes straight to the engine and the
 * overlay is read from a ref each frame, so nothing here re-renders per tick (D-272). `onFrame` hands the head to the
 * reactions. `candles` turns on the candle view (R5.17): closed candles from our one-minute archive grouped into the
 * interval, re-read just after each boundary, the forming one from live ticks. Drag pans back through history (older
 * candles load as it nears them), the wheel zooms, a double-click recentres; a hover or tap shows a crosshair whose
 * every detent ticks.
 */
import type { CandleInterval, ChartOverlay, SessionHistory } from "@senryo/calls";
import { CandleSeries, defaultSpacing, groupCandles, INTERVAL_SEC, unitOf } from "@senryo/calls";
import { priceFromE8 } from "@senryo/core";
import { fillLine } from "@senryo/live";
import { useLive } from "@senryo/live/react";
import { useQueryEnv } from "@senryo/query";
import { memo, type RefObject, useEffect, useRef } from "react";
import { fire } from "@/lib/feedback";
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
  /** The candle view's interval, or null for the line (R5.17). */
  candles?: CandleInterval | null;
  label: string;
}

const MS = 1_000;
/** Candles shown on arrival, and the last few re-read just after each boundary (the archive's minute settles). */
const CANDLES_LOADED = 120;
const CANDLES_REREAD = 3;
const REREAD_AFTER_MS = 4_000;
/** A press that moves less than this is a tap (the crosshair), more a pan. */
const TAP_PX = 6;
/** One wheel notch zooms by this much. */
const WHEEL_ZOOM = 0.0015;

export const LiveChart = memo(function LiveChart({
  symbol,
  overlay,
  waiting,
  onFrame,
  health,
  history,
  candles = null,
  label,
}: LiveChartProps) {
  const live = useLive();
  // The api client is stable; the env object around it is not (a new one would restart the candles each render).
  const api = useQueryEnv().api;
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

  // The candle view: its series, loaded from the archive and re-read at each boundary; the line again when off.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!candles) {
      engine.candles.view = null;
      return;
    }
    const intervalSec = INTERVAL_SEC[candles];
    const series = new CandleSeries(intervalSec * MS);
    const now = () => Date.now() + live.clock.offset;
    engine.candles.reset();
    engine.candles.view = { series, now };
    engine.candles.onDetent = () => fire("tick");
    engine.candles.onOlder = (oldestT) => {
      const to = Math.floor(oldestT / MS);
      void api
        .call(candlesRoute, { query: { symbol, from: to - CANDLES_LOADED * intervalSec, to } })
        .then((r) => active && series.merge(groupCandles(r.candles, intervalSec), now()))
        .catch(() => undefined);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const load = async (count: number) => {
      const to = Math.floor(now() / MS);
      const r = await api
        .call(candlesRoute, { query: { symbol, from: to - count * intervalSec, to } })
        .catch(() => null);
      if (active && r) series.merge(groupCandles(r.candles, intervalSec), now());
    };
    const arm = () => {
      const next = (Math.floor(now() / (intervalSec * MS)) + 1) * intervalSec * MS + REREAD_AFTER_MS;
      timer = setTimeout(() => void load(CANDLES_REREAD).then(arm), next - now());
    };
    void load(CANDLES_LOADED).then(arm);
    return () => {
      active = false;
      clearTimeout(timer);
      if (engineRef.current) engineRef.current.candles.view = null;
    };
  }, [candles, symbol, api, live]);

  // The wheel zooms the candles (a listener of our own: React's is passive and can't keep the page still).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      const engine = engineRef.current;
      if (!engine?.candles.view) return;
      e.preventDefault();
      const l = engine.candles.layout(engine.plotW, engine.candles.spacing ?? defaultSpacing(engine.plotW));
      engine.candles.zoom(Math.exp(-e.deltaY * WHEEL_ZOOM), l);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  const press = useRef<{ x: number; last: number; moved: boolean } | null>(null);
  const pointAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const cross = (e: React.PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (engine?.candles.view) engine.candles.crosshair = pointAt(e);
  };
  const uncross = () => {
    if (engineRef.current) engineRef.current.candles.crosshair = null;
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!engineRef.current?.candles.view) return;
    press.current = { x: e.clientX, last: e.clientX, moved: false };
    if (e.pointerType === "mouse") cross(e);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    const p = press.current;
    if (!engine?.candles.view) return;
    if (p && (p.moved || Math.abs(e.clientX - p.x) > TAP_PX)) {
      p.moved = true;
      uncross();
      const l = engine.candles.layout(engine.plotW, engine.candles.spacing ?? defaultSpacing(engine.plotW));
      engine.candles.pan(e.clientX - p.last, l);
      p.last = e.clientX;
      return;
    }
    if (e.pointerType === "mouse") cross(e);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (p && !p.moved && e.pointerType !== "mouse") cross(e);
  };

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={label}
      className={
        candles ? "relative h-full w-full touch-pan-y overflow-hidden" : "relative h-full w-full overflow-hidden"
      }
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => {
        press.current = null;
        uncross();
      }}
      onDoubleClick={() => engineRef.current?.candles.recentre()}
    >
      <canvas ref={dotsRef} className="absolute inset-0 block h-full w-full" aria-hidden />
      <canvas ref={lineRef} className="absolute inset-0 block h-full w-full" aria-hidden />
    </div>
  );
});
