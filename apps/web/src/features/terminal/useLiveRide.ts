"use client";
/**
 * Every tick of a ride, without rendering React (D-272; `useLiveQuote`'s twin, R5.4–R5.6): the shared ride pass
 * (`@senryo/calls` `rideTick`, the phone's too) written into live values — each side's knock-out under its button,
 * CLOSE's exact amount, TRAIL's caption — into the ref the chart reads each frame, and into the reaction engine.
 * The mark and break-even stay readable synchronously for the tap.
 */
import type { RideView } from "@senryo/api-client";
import {
  type ChartOverlay,
  dollars,
  type QuoteTick,
  type RideTermsLike,
  type RideTrail,
  rideTick,
  trendOf,
  unitOf,
} from "@senryo/calls";
import type { RideLatest } from "@senryo/calls/react";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { liveValue } from "@/lib/terminal/live-value";
import type { CashOutFigure } from "./useLiveQuote";

const UNSOLD = "—";

export interface RideInputs {
  symbol: string;
  margin: bigint;
  leverageBps: number;
  terms: (RideTermsLike & { earlyFeeBps: number; earlyWindowSec: number }) | undefined;
  held: RideView | undefined;
  trailBps: number;
  /** Off while the terminal is on Call: nothing is written. */
  active: boolean;
}

export function useLiveRide(i: RideInputs) {
  const live = useLive();
  const values = useMemo(
    () => ({
      upLine: liveValue(""),
      downLine: liveValue(""),
      close: liveValue<CashOutFigure>({ text: UNSOLD, trend: 0, units: null }),
      trail: liveValue<RideTrail | null>(null),
    }),
    [],
  );
  const overlay = useRef<ChartOverlay | null>(null);
  const latest = useRef<RideLatest>({ markE8: null, breakEvenE8: null });
  const preview = useRef<0 | 1 | null>(null);
  const rerun = useRef<() => void>(() => undefined);
  const lastClose = useRef<bigint | null>(null);
  const lastPnl = useRef<bigint | null>(null);
  const listeners = useRef(new Set<(tick: QuoteTick) => void>());
  const onTick = useCallback((listener: (tick: QuoteTick) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  const setPreview = useCallback((side: 0 | 1 | null) => {
    if (preview.current === side) return;
    preview.current = side;
    rerun.current();
  }, []);

  const { symbol, margin, leverageBps, terms, held, trailBps, active } = i;
  useEffect(() => {
    if (!active) return;
    const run = () => {
      const tick = live.prices.latest(symbol);
      if (!tick || !terms || live.prices.isStale(symbol)) {
        latest.current = { markE8: null, breakEvenE8: null };
        overlay.current = null;
        values.upLine.set("");
        values.downLine.set("");
        return;
      }
      const markE8 = BigInt(Math.round(tick.priceE8));
      const pass = rideTick({
        markE8,
        nowSec: live.clock.nowSec(),
        margin,
        leverageBps,
        terms,
        held,
        trailBps,
        preview: preview.current,
        unit: unitOf(symbol),
      });
      values.upLine.set(pass.upLine);
      values.downLine.set(pass.downLine);
      values.trail.set(pass.trail);
      if (pass.closeValue !== null) {
        values.close.set({
          text: dollars(pass.closeValue),
          trend: trendOf(lastClose.current, pass.closeValue),
          units: pass.closeValue,
        });
        lastClose.current = pass.closeValue;
      } else {
        values.close.set({ text: UNSOLD, trend: 0, units: null });
      }
      overlay.current =
        pass.pnl === null ? pass.overlay : { ...pass.overlay, pnlTrend: trendOf(lastPnl.current, pass.pnl) };
      lastPnl.current = pass.pnl;
      latest.current = { markE8, breakEvenE8: pass.breakEvenE8 };
      const reaction: QuoteTick = { t: performance.now(), price: priceFromE8(tick.priceE8), position: pass.reading };
      for (const listener of listeners.current) listener(reaction);
    };
    rerun.current = run;
    run();
    return live.prices.subscribe(symbol, run);
  }, [live, symbol, margin, leverageBps, terms, held, trailBps, active, values]);

  return { ...values, overlay, latest, onTick, setPreview };
}
