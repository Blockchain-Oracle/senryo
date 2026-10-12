"use client";
/**
 * Every tick, without rendering React (D-272): the shared quote pass (`@senryo/calls` `quoteTick`, the phone's too)
 * written into live values the odds, the line text and the cash-out paint straight into the DOM, and into the ref the
 * chart reads each frame. The latest quotes stay readable synchronously for the tap (the limit is the quote seen).
 */
import type { WindowLoad } from "@senryo/api-client";
import {
  type CallMode,
  type ChartOverlay,
  dollars,
  fillMark,
  offerOf,
  type PoolTerms,
  pricingFor,
  type Quotes,
  type QuoteTick,
  quoteTick,
  trendOf,
  unitOf,
} from "@senryo/calls";
import type { CallWindowView } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { liveValue } from "@/lib/terminal/live-value";

export interface CashOutFigure {
  text: string;
  trend: number;
}

/** The cash-out button's amount while the pool won't buy the call back. */
const UNSOLD = "—";

export function useLiveQuote(
  t: CallWindowView,
  stake: bigint,
  load: WindowLoad | undefined,
  mode: CallMode = "updown",
) {
  const live = useLive();
  const values = useMemo(
    () => ({
      firstLine: liveValue(""),
      secondLine: liveValue(""),
      note: liveValue<string | null>(null),
      lineText: liveValue(""),
      cashOut: liveValue<CashOutFigure>({ text: "", trend: 0 }),
    }),
    [],
  );
  const overlay = useRef<ChartOverlay | null>(null);
  /** The offered side under the pointer or focus: the next pass shades where it wins (F8). */
  const preview = useRef<0 | 1 | null>(null);
  const rerun = useRef<() => void>(() => undefined);
  const setPreview = useCallback((side: 0 | 1 | null) => {
    if (preview.current === side) return;
    preview.current = side;
    rerun.current();
  }, []);
  const latest = useRef<Quotes>({ first: null, second: null, close: null });
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
  const unit = unitOf(t.symbol);
  const offer = useMemo(() => offerOf(mode, bands, t.k, unit), [mode, bands, t.k, unit]);
  const position = t.position;
  const positionBand = position ? bands?.[position.band] : undefined;
  const cadence = t.series?.cadenceSec as CadenceSec | undefined;
  const pricing = useMemo(
    () => (t.terms && cadence ? pricingFor(t.terms as PoolTerms, cadence, load) : undefined),
    [t.terms, cadence, load],
  );

  useEffect(() => {
    const run = () => {
      const tick = live.prices.latest(t.symbol);
      if (!tick || !t.series || !pricing || t.k === undefined) {
        values.firstLine.set("");
        values.secondLine.set("");
        values.note.set(null);
        values.lineText.set("");
        overlay.current = null;
        latest.current = { first: null, second: null, close: null };
        return;
      }
      const nowSec = live.clock.nowSec();
      const pass = quoteTick({
        priceE8: tick.priceE8,
        nowSec,
        k: t.k,
        expiry: t.window.expiry,
        mark: fillMark(live.sigma, t.symbol, t.series, nowSec),
        pricing,
        stake,
        offer: [offer[0]?.band, offer[1]?.band],
        unit,
        position: position && positionBand ? { call: position, band: positionBand } : undefined,
        preview: preview.current,
      });
      values.firstLine.set(pass.firstLine);
      values.secondLine.set(pass.secondLine);
      values.note.set(pass.note);
      values.lineText.set(pass.lineText);
      if (pass.pnl !== null) {
        overlay.current = { ...pass.overlay, pnlTrend: trendOf(lastPnl.current, pass.pnl) };
        lastPnl.current = pass.pnl;
      } else {
        overlay.current = pass.overlay;
      }
      // Beyond the pool's bounds a held call can't be sold (it pays at expiry): no amount on the button.
      if (pass.proceeds !== null) {
        values.cashOut.set({ text: dollars(pass.proceeds), trend: trendOf(lastProceeds.current, pass.proceeds) });
        lastProceeds.current = pass.proceeds;
      } else if (pass.close) {
        values.cashOut.set({ text: UNSOLD, trend: 0 });
      }
      latest.current = { first: pass.first, second: pass.second, close: pass.close };
      const reaction: QuoteTick = { t: performance.now(), price: priceFromE8(tick.priceE8), position: pass.reading };
      for (const listener of listeners.current) listener(reaction);
    };
    rerun.current = run;
    run();
    return live.prices.subscribe(t.symbol, run);
  }, [live, t.symbol, t.series, t.k, t.window.expiry, stake, offer, position, positionBand, pricing, values]);

  return { ...values, overlay, latest, offer, onTick, setPreview };
}
