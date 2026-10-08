/**
 * Every tick, on the JS thread and without rendering React (D-272): price Up and Down for the current stake with the
 * contracts' own maths (`@senryo/core/market`, bit for bit with `quoteOpen`), value the open call's cash-out, measure
 * the distance to K, and write it all into shared values the chart, the odometers and the quote lines read. The latest
 * quotes stay readable synchronously for the tap (the limit is the quote the user saw).
 */
import { FILL_DELAY_SEC } from "@senryo/config";
import {
  type BandShape,
  type CloseQuote,
  formatUnits,
  multiplierE2,
  type OpenQuote,
  P_ONE,
  type QuoteTerms,
  quoteClose,
  quoteOpen,
} from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useEffect, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { LiveFigure } from "~/components/kit/LiveOdometer";
import type { ChartOverlay } from "./chart/draw";
import { PRICE_DECIMALS } from "./constants";
import type { TerminalView } from "./useTerminal";

const E8 = 1e8;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const PERCENT = 100;
/** The distance to the line in thousandths of a percent: a 1-minute move is often under 0.01 %. */
const PERCENT_E3 = 100_000n;
const PERCENT_DECIMALS = 3;

export interface Quotes {
  up: OpenQuote | null;
  down: OpenQuote | null;
  close: CloseQuote | null;
}

/** Which way a money figure moved, compared as bigints (−1, 0, 1). */
const trendOf = (was: bigint | null, now: bigint) => (was === null || was === now ? 0 : now > was ? 1 : -1);

const money = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;
const signedMoney = (v: bigint) => `${v < 0n ? "−" : "+"}${money(v)}`;

function oddsLine(q: OpenQuote | null, stake: bigint): string {
  if (!q || q.refusal) return "Not priced now";
  const x = multiplierE2(stake, q.payout);
  const pct = (q.probE6 * BigInt(PERCENT)) / P_ONE;
  return `pays ${formatUnits(x, CENTS, CENTS)}× · about ${pct}%`;
}

export function useLiveQuote(t: TerminalView, stake: bigint) {
  const live = useLive();
  const upLine = useSharedValue("");
  const downLine = useSharedValue("");
  const lineText = useSharedValue("");
  const cashOut = useSharedValue<LiveFigure>({ text: "", trend: 0 });
  const lastProceeds = useRef<bigint | null>(null);
  const lastPnl = useRef<bigint | null>(null);
  const overlay = useSharedValue<ChartOverlay | null>(null);
  const latest = useRef<Quotes>({ up: null, down: null, close: null });

  const bands = t.series?.bands;
  const upBand = bands?.find((b) => b.kind === "up");
  const downBand = bands?.find((b) => b.kind === "down");
  const position = t.position;
  const positionBand = position ? bands?.[position.band] : undefined;

  useEffect(() => {
    const terms: QuoteTerms | undefined = t.terms && {
      halfSpreadE6: BigInt(t.terms.halfSpreadE6),
      minProbE6: BigInt(t.terms.minProbE6),
      maxProbE6: BigInt(t.terms.maxProbE6),
      surchargeE6: 0n,
    };
    const run = () => {
      const tick = live.prices.latest(t.symbol);
      if (!tick || !t.series || !terms || t.k === undefined) {
        upLine.value = downLine.value = lineText.value = "";
        overlay.value = null;
        latest.current = { up: null, down: null, close: null };
        return;
      }
      const spot = BigInt(Math.round(tick.priceE8));
      const tauSec = BigInt(Math.max(0, t.window.expiry - (live.clock.nowSec() + FILL_DELAY_SEC)));
      const w = { openE8: t.k, sigmaE8: BigInt(t.series.sigmaE8), tauSec };
      const shape = (b: { kind: BandShape["kind"]; lowBps: number; highBps: number }): BandShape => b;
      const up = upBand ? quoteOpen(shape(upBand), w, spot, stake, terms) : null;
      const down = downBand ? quoteOpen(shape(downBand), w, spot, stake, terms) : null;
      upLine.value = oddsLine(up, stake);
      downLine.value = oddsLine(down, stake);

      const diff = spot - t.k;
      const pct = t.k > 0n ? (diff * PERCENT_E3) / t.k : 0n;
      lineText.value = `${diff >= 0n ? "▲" : "▼"} $${formatUnits(diff < 0n ? -diff : diff, PRICE_DECIMALS, CENTS)} (${formatUnits(pct < 0n ? -pct : pct, PERCENT_DECIMALS, PERCENT_DECIMALS)}%) ${diff >= 0n ? "above" : "below"} the line`;

      let close: CloseQuote | null = null;
      if (position && positionBand && position.state !== "committed") {
        close = quoteClose(shape(positionBand), w, spot, position.payout, terms);
        const pnl = close.proceeds - position.stake;
        cashOut.value = { text: money(close.proceeds), trend: trendOf(lastProceeds.current, close.proceeds) };
        lastProceeds.current = close.proceeds;
        const winning = positionBand.kind === "down" ? spot < t.k : spot > t.k;
        const pnlTrend = trendOf(lastPnl.current, pnl);
        lastPnl.current = pnl;
        overlay.value = {
          winning,
          pnlText: signedMoney(pnl),
          pnlTrend,
          line: Number(t.k) / E8,
          zone: positionBand.kind === "down" ? "below" : "above",
          levels: [
            { kind: "line", price: Number(t.k) / E8, label: "Line" },
            ...(position.entryE8 !== null
              ? [{ kind: "entry" as const, price: Number(position.entryE8) / E8, label: "Entry" }]
              : []),
          ],
        };
      } else {
        overlay.value = {
          winning: null,
          pnlText: null,
          pnlTrend: 0,
          line: Number(t.k) / E8,
          zone: null,
          levels: [{ kind: "line", price: Number(t.k) / E8, label: "Line" }],
        };
      }
      latest.current = { up, down, close };
    };
    run();
    return live.prices.subscribe(t.symbol, run);
  }, [
    live,
    t.symbol,
    t.series,
    t.terms,
    t.k,
    t.window.expiry,
    stake,
    upBand,
    downBand,
    position,
    positionBand,
    upLine,
    downLine,
    lineText,
    cashOut,
    overlay,
  ]);

  return { upLine, downLine, lineText, cashOut, overlay, latest, upBand, downBand };
}
