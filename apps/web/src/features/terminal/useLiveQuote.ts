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
  callTrailCaption,
  callTrailReady,
  DEFAULT_CALL_TRAIL_CENTS,
  dollars,
  feesWords,
  fillMark,
  offerOf,
  type PoolTerms,
  paysWords,
  pricingFor,
  type Quotes,
  type QuoteTick,
  quoteTick,
  trendOf,
  unitOf,
} from "@senryo/calls";
import type { CallWindowView } from "@senryo/calls/react";
import { type CadenceSec, MARKETS, slippageE6 } from "@senryo/config";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { liveValue } from "@/lib/terminal/live-value";
import type { TrailView } from "./TradeButtons";

export interface CashOutFigure {
  text: string;
  trend: number;
  /** The amount behind the text (null: nothing to close for now). */
  units: bigint | null;
}

/** The cash-out button's amount while the pool won't buy the call back. */
const UNSOLD = "—";

export function useLiveQuote(
  t: CallWindowView,
  stake: bigint,
  load: WindowLoad | undefined,
  mode: CallMode = "updown",
  trailCents: number = DEFAULT_CALL_TRAIL_CENTS,
) {
  const live = useLive();
  const values = useMemo(
    () => ({
      firstLine: liveValue(""),
      secondLine: liveValue(""),
      note: liveValue<string | null>(null),
      lineText: liveValue(""),
      cashOut: liveValue<CashOutFigure>({ text: "", trend: 0, units: null }),
      /** The order stack's live rows (R5.4) and TRAIL's state for a held call (R5.5). */
      pays: liveValue("—"),
      fees: liveValue("—"),
      trail: liveValue<TrailView | null>(null),
    }),
    [],
  );
  /** The bid TRAIL floors at (break-even's), read at the tap. */
  const trailFloor = useRef<number | null>(null);
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
  // R5.8 (D-300): the limit a tap signs is the quote at a p99 2-second move against it, by market.
  const slipE6 = useMemo(() => {
    const spec = MARKETS.find((m) => m.symbol === t.symbol);
    return spec ? slippageE6(spec) : undefined;
  }, [t.symbol]);
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
        slipE6,
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
        values.cashOut.set({
          text: dollars(pass.proceeds),
          trend: trendOf(lastProceeds.current, pass.proceeds),
          units: pass.proceeds,
        });
        lastProceeds.current = pass.proceeds;
      } else if (pass.close) {
        values.cashOut.set({ text: UNSOLD, trend: 0, units: null });
      }
      latest.current = { first: pass.first, second: pass.second, close: pass.close, limits: pass.limits };
      const shown = offer[1] ? [pass.first, pass.second] : [pass.first];
      values.pays.set(paysWords(shown, stake));
      values.fees.set(feesWords(shown, stake));
      if (pass.close && position && position.state !== "committed") {
        const exit = position.exit;
        const armed = (exit?.trailE6 ?? 0) > 0;
        const r = callTrailReady(pass.close.bidE6, position.stake, position.payout, trailCents);
        trailFloor.current = r.floorE6;
        values.trail.set({
          armed,
          ready: r.ready && !pass.close.refusal,
          caption: armed ? callTrailCaption(exit?.trailStopE6 ?? null) : r.caption,
        });
      } else {
        trailFloor.current = null;
        values.trail.set(null);
      }
      const reaction: QuoteTick = { t: performance.now(), price: priceFromE8(tick.priceE8), position: pass.reading };
      for (const listener of listeners.current) listener(reaction);
    };
    rerun.current = run;
    run();
    return live.prices.subscribe(t.symbol, run);
  }, [
    live,
    t.symbol,
    t.series,
    t.k,
    t.window.expiry,
    stake,
    offer,
    position,
    positionBand,
    pricing,
    slipE6,
    values,
    trailCents,
  ]);

  return { ...values, overlay, latest, offer, onTick, setPreview, trailFloor };
}
