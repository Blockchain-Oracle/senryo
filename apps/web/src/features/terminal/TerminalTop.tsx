"use client";
/**
 * The terminal's top (the phone's `TerminalTop`, Tradash's asset chip): the market chip (real mark, symbol, its 24 h
 * graph and change — D-319, F7; opens the markets drawer), the music, equity (Tradash's pill: cash + every open
 * position's live value, rolling — R5.3), and the lanes — 1m · 5m · 15m · 1h — the selected one carrying the
 * countdown ring to the moment calls close, on the server's clock.
 */
import { type CallWindowView, useDayLine, useLiveBook } from "@senryo/calls/react";
import { CADENCES_SEC, type CadenceSec, LOCKOUT_SEC } from "@senryo/config";
import { clockText, laneLabel } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { ChevronDown } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ChangeChip } from "@/components/ui/change-chip";
import { Odometer, viewDollars } from "@/components/ui/odometer";
import { Sparkline } from "@/components/ui/sparkline";
import { fire, tapFeedback } from "@/lib/feedback";
import { CountdownRing } from "./CountdownRing";
import { MusicToggle } from "./MusicToggle";
import "./terminal-top.css";

const MARK = 28;

/** Equity: cash plus what every open position would return now (Tradash's pill), rolling; cash until the book loads. */
function Equity({ cash }: { cash: bigint | undefined }) {
  const book = useLiveBook();
  const equity = book.ready ? book.totals.equity : cash;
  if (equity === null || equity === undefined) return null;
  return (
    <span className="terminal-balance" title="Cash and your open positions at their live value">
      <span className="sr-only">Equity </span>
      <Odometer value={viewDollars(equity)} sensitive />
    </span>
  );
}

export function TerminalTop({
  t,
  onPickMarket,
  onCadence,
}: {
  t: CallWindowView;
  onPickMarket: () => void;
  onCadence: (c: CadenceSec) => void;
}) {
  const day = useDayLine(t.symbol);
  return (
    <div className="terminal-top">
      {/* One h1 per page (R2.18): the market the terminal is on; the chip below is its button. */}
      <h1 className="sr-only">
        {t.symbol}
        {t.market?.name ? ` · ${t.market.name}` : ""}
      </h1>
      <div className="terminal-top-row">
        <button
          type="button"
          className="terminal-asset"
          aria-label={`${t.market?.name ?? t.symbol}. Change market`}
          onClick={() => {
            tapFeedback();
            onPickMarket();
          }}
        >
          <EntityMark id={marketId(t.symbol)} size={MARK} decorative />
          <span className="terminal-asset-symbol">{t.symbol}</span>
          <span className="terminal-asset-name">{t.market?.name}</span>
          <ChevronDown aria-hidden className="terminal-asset-chevron" />
        </button>
        {day ? (
          <span className="terminal-day" title="The last 24 hours">
            <Sparkline symbol={t.symbol} day={day} className="h-6 w-16 sm:h-6 sm:w-16" />
            <ChangeChip symbol={t.symbol} day={day} />
          </span>
        ) : null}
        <MusicToggle />
        <Equity cash={t.balance} />
      </div>
      <div className="terminal-lanes" role="tablist" aria-label="Window length">
        {CADENCES_SEC.map((c) => {
          const selected = c === t.cadenceSec;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${laneLabel(c)} windows`}
              className="terminal-lane"
              onClick={() => {
                if (selected) return;
                fire("tick", { cue: "tap" });
                onCadence(c);
              }}
            >
              {selected ? (
                <CountdownRing fromSec={t.window.start} toSec={t.window.expiry - LOCKOUT_SEC} nowSec={t.now} />
              ) : null}
              <span>{laneLabel(c)}</span>
              {selected ? (
                <span className="tnum">
                  {t.window.trading ? clockText(t.window.closesIn) : clockText(t.window.expiry - t.now)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
