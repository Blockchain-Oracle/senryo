/**
 * Every tick, on the JS thread and without rendering React (D-272): the shared quote pass (`@senryo/calls`
 * `quoteTick`: the mode's two bands for the current stake with the contracts' own maths, the open call's cash-out, the distance
 * to K, the chart's overlay) written into shared values the chart, the odometers and the quote lines read. The latest
 * quotes stay readable synchronously for the tap (the limit is the quote the user saw).
 */
import type { WindowLoad } from "@senryo/api-client";
import {
  type CallMode,
  type QuoteTick as CallsQuoteTick,
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
  quoteTick,
  trendOf,
  unitOf,
} from "@senryo/calls";
import { type CadenceSec, MARKETS, slippageE6 } from "@senryo/config";
import { priceFromE8 } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { LiveFigure } from "~/components/kit/LiveOdometer";
import { useHeldState } from "./useHeldState";
import type { TerminalView } from "./useTerminal";

export type QuoteTick = CallsQuoteTick;

/** The cash-out button's amount while the pool won't buy the call back. */
const UNSOLD = "—";

export function useLiveQuote(
  t: TerminalView,
  stake: bigint,
  load: WindowLoad | undefined,
  mode: CallMode,
  trailCents: number = DEFAULT_CALL_TRAIL_CENTS,
) {
  const live = useLive();
  /** The order stack's live rows (R5.4) and a held call's TRAIL caption (R5.5). */
  const pays = useSharedValue("—");
  const fees = useSharedValue("—");
  const trailCaption = useSharedValue("");
  const [held, writeHeld] = useHeldState();
  /** The bid TRAIL floors at (break-even's), read at the tap. */
  const trailFloor = useRef<number | null>(null);
  const firstLine = useSharedValue("");
  const secondLine = useSharedValue("");
  /** Why a shown side has no price (one sentence under the buttons), or "" (F8). */
  const note = useSharedValue("");
  const lineText = useSharedValue("");
  const cashOut = useSharedValue<LiveFigure>({ text: "", trend: 0 });
  const overlay = useSharedValue<ChartOverlay | null>(null);
  const lastProceeds = useRef<bigint | null>(null);
  const lastPnl = useRef<bigint | null>(null);
  const latest = useRef<Quotes>({ first: null, second: null, close: null });
  /** The side held under a finger: the next pass shades where it wins (F8). */
  const preview = useRef<0 | 1 | null>(null);
  const rerun = useRef<() => void>(() => undefined);
  const setPreview = useCallback((side: 0 | 1 | null) => {
    if (preview.current === side) return;
    preview.current = side;
    rerun.current();
  }, []);
  // Tick listeners (the reactions): fed from the same pass as the quotes, so nothing is computed twice.
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
  // The load surcharge and the pool's room come from `/v1/markets/load` (polled; refreshed on the user's fills).
  const cadence = t.series?.cadenceSec as CadenceSec | undefined;
  const pricing = useMemo(
    () => (t.terms && cadence ? pricingFor(t.terms as PoolTerms, cadence, load) : undefined),
    [t.terms, cadence, load],
  );

  useEffect(() => {
    const run = () => {
      const tick = live.prices.latest(t.symbol);
      if (!tick || !t.series || !pricing || t.k === undefined) {
        firstLine.value = secondLine.value = note.value = lineText.value = "";
        overlay.value = null;
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
      firstLine.value = pass.firstLine;
      secondLine.value = pass.secondLine;
      note.value = pass.note ?? "";
      lineText.value = pass.lineText;
      if (pass.pnl !== null) {
        overlay.value = { ...pass.overlay, pnlTrend: trendOf(lastPnl.current, pass.pnl) };
        lastPnl.current = pass.pnl;
      } else {
        overlay.value = pass.overlay;
      }
      // Beyond the pool's bounds a held call can't be sold (it pays at expiry): no amount on the button.
      if (pass.proceeds !== null) {
        cashOut.value = { text: dollars(pass.proceeds), trend: trendOf(lastProceeds.current, pass.proceeds) };
        lastProceeds.current = pass.proceeds;
      } else if (pass.close) {
        cashOut.value = { text: UNSOLD, trend: 0 };
      }
      latest.current = { first: pass.first, second: pass.second, close: pass.close, limits: pass.limits };
      const shown = offer[1] ? [pass.first, pass.second] : [pass.first];
      pays.value = paysWords(shown, stake);
      fees.value = feesWords(shown, stake);
      if (pass.close && position && position.state !== "committed") {
        const exit = position.exit;
        const armed = (exit?.trailE6 ?? 0) > 0;
        const r = callTrailReady(pass.close.bidE6, position.stake, position.payout, trailCents);
        trailFloor.current = r.floorE6;
        trailCaption.value = armed ? callTrailCaption(exit?.trailStopE6 ?? null) : r.caption;
        writeHeld({ armed, ready: r.ready && !pass.close.refusal, closable: pass.proceeds !== null });
      } else {
        trailFloor.current = null;
        writeHeld(null);
      }
      const reactionTick: QuoteTick = {
        t: performance.now(),
        price: priceFromE8(tick.priceE8),
        position: pass.reading,
      };
      for (const listener of listeners.current) listener(reactionTick);
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
    unit,
    position,
    positionBand,
    pricing,
    slipE6,
    firstLine,
    secondLine,
    note,
    lineText,
    cashOut,
    overlay,
    pays,
    fees,
    trailCaption,
    writeHeld,
    trailCents,
  ]);

  return {
    firstLine,
    secondLine,
    note,
    lineText,
    cashOut,
    overlay,
    latest,
    offer,
    onTick,
    setPreview,
    pays,
    fees,
    trailCaption,
    held,
    trailFloor,
  };
}
