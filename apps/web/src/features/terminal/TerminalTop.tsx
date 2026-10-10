"use client";
/**
 * The terminal's top (the phone's `TerminalTop`, Tradash's asset chip): the market chip (real mark, symbol, the price
 * rolling; opens the markets drawer), the balance, and the lanes — 1m · 5m · 15m · 1h — the selected one carrying the
 * countdown ring to the moment calls close, on the server's clock.
 */
import type { CallWindowView } from "@senryo/calls/react";
import { CADENCES_SEC, type CadenceSec, LOCKOUT_SEC } from "@senryo/config";
import { clockText, laneLabel } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { ChevronDown } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { fire, tapFeedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { CountdownRing } from "./CountdownRing";

const MARK = 28;

export function TerminalTop({
  t,
  onPickMarket,
  onCadence,
}: {
  t: CallWindowView;
  onPickMarket: () => void;
  onCadence: (c: CadenceSec) => void;
}) {
  const hidden = usePrivacy();
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
        {t.balance !== undefined ? (
          <span className="terminal-balance tnum">
            <span className="sr-only">Balance </span>
            {masked(money(t.balance), hidden)}
          </span>
        ) : null}
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
