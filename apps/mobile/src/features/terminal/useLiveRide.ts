/**
 * Every tick of a ride on the phone, without rendering React (D-272; the web's `useLiveRide`, R5.4–R5.6): the shared
 * ride pass (`@senryo/calls` `rideTick`) written into shared values — each side's knock-out under its button, CLOSE's
 * rolling amount, TRAIL's caption — the chart's overlay and the reaction engine; TRAIL and CLOSE re-render only when
 * they flip (`useHeldState`). The mark and break-even stay readable synchronously for the tap.
 */
import type { RideView } from "@senryo/api-client";
import {
  type ChartOverlay,
  dollars,
  type QuoteTick,
  type RideTermsLike,
  rideTick,
  trendOf,
  unitOf,
} from "@senryo/calls";
import type { RideLatest } from "@senryo/calls/react";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { LiveFigure } from "~/components/kit/LiveOdometer";
import { useHeldState } from "./useHeldState";

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
  const upLine = useSharedValue("");
  const downLine = useSharedValue("");
  const close = useSharedValue<LiveFigure>({ text: UNSOLD, trend: 0 });
  const trailCaption = useSharedValue("");
  const overlay = useSharedValue<ChartOverlay | null>(null);
  const [held, writeHeld] = useHeldState();
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

  const { symbol, margin, leverageBps, terms, held: ride, trailBps, active } = i;
  useEffect(() => {
    if (!active) return;
    const run = () => {
      const tick = live.prices.latest(symbol);
      if (!tick || !terms || live.prices.isStale(symbol)) {
        latest.current = { markE8: null, breakEvenE8: null };
        overlay.value = null;
        upLine.value = downLine.value = "";
        return;
      }
      const markE8 = BigInt(Math.round(tick.priceE8));
      const pass = rideTick({
        markE8,
        nowSec: live.clock.nowSec(),
        margin,
        leverageBps,
        terms,
        held: ride,
        trailBps,
        preview: preview.current,
        unit: unitOf(symbol),
      });
      upLine.value = pass.upLine;
      downLine.value = pass.downLine;
      trailCaption.value = pass.trail?.caption ?? "";
      if (pass.closeValue !== null) {
        close.value = { text: dollars(pass.closeValue), trend: trendOf(lastClose.current, pass.closeValue) };
        lastClose.current = pass.closeValue;
      } else {
        close.value = { text: UNSOLD, trend: 0 };
      }
      writeHeld(
        pass.trail ? { armed: pass.trail.armed, ready: pass.trail.ready, closable: pass.closeValue !== null } : null,
      );
      overlay.value =
        pass.pnl === null ? pass.overlay : { ...pass.overlay, pnlTrend: trendOf(lastPnl.current, pass.pnl) };
      lastPnl.current = pass.pnl;
      latest.current = { markE8, breakEvenE8: pass.breakEvenE8 };
      const reaction: QuoteTick = { t: performance.now(), price: priceFromE8(tick.priceE8), position: pass.reading };
      for (const listener of listeners.current) listener(reaction);
    };
    rerun.current = run;
    run();
    return live.prices.subscribe(symbol, run);
  }, [
    live,
    symbol,
    margin,
    leverageBps,
    terms,
    ride,
    trailBps,
    active,
    upLine,
    downLine,
    close,
    trailCaption,
    overlay,
    writeHeld,
  ]);

  return { upLine, downLine, close, trailCaption, overlay, held, latest, onTick, setPreview };
}
