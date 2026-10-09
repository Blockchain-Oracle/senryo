/**
 * Every tick, on the JS thread and without rendering React (D-272): the shared quote pass (`@senryo/calls`
 * `quoteTick`: Up and Down for the current stake with the contracts' own maths, the open call's cash-out, the distance
 * to K, the chart's overlay) written into shared values the chart, the odometers and the quote lines read. The latest
 * quotes stay readable synchronously for the tap (the limit is the quote the user saw).
 */
import type { WindowLoad } from "@senryo/api-client";
import {
  type QuoteTick as CallsQuoteTick,
  type ChartOverlay,
  dollars,
  type PoolTerms,
  pricingFor,
  type Quotes,
  quoteTick,
  trendOf,
} from "@senryo/calls";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { LiveFigure } from "~/components/kit/LiveOdometer";
import type { TerminalView } from "./useTerminal";

export type QuoteTick = CallsQuoteTick;

export function useLiveQuote(t: TerminalView, stake: bigint, load: WindowLoad | undefined) {
  const live = useLive();
  const upLine = useSharedValue("");
  const downLine = useSharedValue("");
  const lineText = useSharedValue("");
  const cashOut = useSharedValue<LiveFigure>({ text: "", trend: 0 });
  const overlay = useSharedValue<ChartOverlay | null>(null);
  const lastProceeds = useRef<bigint | null>(null);
  const lastPnl = useRef<bigint | null>(null);
  const latest = useRef<Quotes>({ up: null, down: null, close: null });
  // Tick listeners (the reactions): fed from the same pass as the quotes, so nothing is computed twice.
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
  // The load surcharge and the pool's room come from `/v1/markets/load` (polled; refreshed on the user's fills).
  const pricing = useMemo(() => (t.terms ? pricingFor(t.terms as PoolTerms, load) : undefined), [t.terms, load]);

  useEffect(() => {
    const run = () => {
      const tick = live.prices.latest(t.symbol);
      if (!tick || !t.series || !pricing || t.k === undefined) {
        upLine.value = downLine.value = lineText.value = "";
        overlay.value = null;
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
      upLine.value = pass.upLine;
      downLine.value = pass.downLine;
      lineText.value = pass.lineText;
      if (pass.proceeds !== null && pass.pnl !== null) {
        cashOut.value = { text: dollars(pass.proceeds), trend: trendOf(lastProceeds.current, pass.proceeds) };
        lastProceeds.current = pass.proceeds;
        overlay.value = { ...pass.overlay, pnlTrend: trendOf(lastPnl.current, pass.pnl) };
        lastPnl.current = pass.pnl;
      } else {
        overlay.value = pass.overlay;
      }
      latest.current = { up: pass.up, down: pass.down, close: pass.close };
      const reactionTick: QuoteTick = {
        t: performance.now(),
        price: priceFromE8(tick.priceE8),
        position: pass.reading,
      };
      for (const listener of listeners.current) listener(reactionTick);
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
    upLine,
    downLine,
    lineText,
    cashOut,
    overlay,
  ]);

  return { upLine, downLine, lineText, cashOut, overlay, latest, upBand, downBand, onTick };
}
