"use client";
/**
 * Every tick, without rendering React (D-272): the shared quote pass (`@senryo/calls` `quoteTick`, the phone's too)
 * written into live values the odds, the line text and the cash-out paint straight into the DOM, and into the ref the
 * chart reads each frame. The latest quotes stay readable synchronously for the tap (the limit is the quote seen).
 */
import type { WindowLoad } from "@senryo/api-client";
import {
  type ChartOverlay,
  dollars,
  type PoolTerms,
  pricingFor,
  type Quotes,
  type QuoteTick,
  quoteTick,
  trendOf,
} from "@senryo/calls";
import type { CallWindowView } from "@senryo/calls/react";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { liveValue } from "@/lib/terminal/live-value";

export interface CashOutFigure {
  text: string;
  trend: number;
}

export function useLiveQuote(t: CallWindowView, stake: bigint, load: WindowLoad | undefined) {
  const live = useLive();
  const values = useMemo(
    () => ({
      upLine: liveValue(""),
      downLine: liveValue(""),
      lineText: liveValue(""),
      cashOut: liveValue<CashOutFigure>({ text: "", trend: 0 }),
    }),
    [],
  );
  const overlay = useRef<ChartOverlay | null>(null);
  const latest = useRef<Quotes>({ up: null, down: null, close: null });
  const lastProceeds = useRef<bigint | null>(null);
  const lastPnl = useRef<bigint | null>(null);
  const listeners = useRef(new Set<(tick: QuoteTick) => void>());
  const onTick = useCallback((listener: (tick: QuoteTick) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const bands = t.series?.bands;
  const upBand = bands?.find((b) => b.kind === "up");
  const downBand = bands?.find((b) => b.kind === "down");
  const position = t.position;
  const positionBand = position ? bands?.[position.band] : undefined;
  const pricing = useMemo(() => (t.terms ? pricingFor(t.terms as PoolTerms, load) : undefined), [t.terms, load]);

  useEffect(() => {
    const run = () => {
      const tick = live.prices.latest(t.symbol);
      if (!tick || !t.series || !pricing || t.k === undefined) {
        values.upLine.set("");
        values.downLine.set("");
        values.lineText.set("");
        overlay.current = null;
        latest.current = { up: null, down: null, close: null };
        return;
      }
      const pass = quoteTick({
        priceE8: tick.priceE8,
        nowSec: live.clock.nowSec(),
        k: t.k,
        expiry: t.window.expiry,
        sigmaE8: t.series.sigmaE8,
        pricing,
        stake,
        up: upBand,
        down: downBand,
        position: position && positionBand ? { call: position, band: positionBand } : undefined,
      });
      values.upLine.set(pass.upLine);
      values.downLine.set(pass.downLine);
      values.lineText.set(pass.lineText);
      if (pass.proceeds !== null && pass.pnl !== null) {
        values.cashOut.set({ text: dollars(pass.proceeds), trend: trendOf(lastProceeds.current, pass.proceeds) });
        lastProceeds.current = pass.proceeds;
        overlay.current = { ...pass.overlay, pnlTrend: trendOf(lastPnl.current, pass.pnl) };
        lastPnl.current = pass.pnl;
      } else {
        overlay.current = pass.overlay;
      }
      latest.current = { up: pass.up, down: pass.down, close: pass.close };
      const reaction: QuoteTick = { t: performance.now(), price: priceFromE8(tick.priceE8), position: pass.reading };
      for (const listener of listeners.current) listener(reaction);
    };
    run();
    return live.prices.subscribe(t.symbol, run);
  }, [
    live,
    t.symbol,
    t.series,
    t.k,
    t.window.expiry,
    stake,
    upBand,
    downBand,
    position,
    positionBand,
    pricing,
    values,
  ]);

  return { ...values, overlay, latest, upBand, downBand, onTick };
}
