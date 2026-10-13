"use client";
/**
 * Search's market rows (R6.4, Codex direction 13): the real mark, symbol over name · kind, the four lanes in plain
 * cells while it trades (its session, pause or listing in words while it doesn't), the 24 h graph, the price as it
 * streams and its change as plain signed text; a separate chevron opens the market's page. Lane rows and the hidden
 * Up / Down / Ride rows are the compact form. Live figures re-render on their own; rows never reorder under them.
 */
import { dayChange, unitOf } from "@senryo/calls";
import { useDayLine, useMarketLanes } from "@senryo/calls/react";
import { MARKETS } from "@senryo/config";
import { formatPrice, priceFromE8 } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice, useSampledPrice } from "@senryo/live/react";
import { KIND_WORDS, type SearchEntry } from "@senryo/search";
import { ChevronRight } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

const MARK = 36;
const MARK_SMALL = 32;
const TAIL_MS = 1_000;

export function LivePrice({ symbol, className }: { symbol: string; className?: string }) {
  const e8 = useLivePrice(symbol);
  return (
    <span className={cn("tnum", className)}>
      {e8 === undefined ? "—" : formatPrice(priceFromE8(e8), undefined, unitOf(symbol))}
    </span>
  );
}

/** "↑ +2.34%" as plain text in the direction's colour (no plate here, Codex direction 13). */
export function DayChangeText({ symbol, suffix = false }: { symbol: string; suffix?: boolean }) {
  const day = useDayLine(symbol);
  const now = useSampledPrice(symbol, TAIL_MS);
  if (!day || now === undefined) return null;
  const c = dayChange(day.openE8, now);
  return (
    <span className={cn("search-change tnum", `is-${c.tone}`)}>
      {c.text}
      {suffix ? " · 24h" : ""}
    </span>
  );
}

/** The four lanes while the market trades, else its line's words. */
export function LaneStrip({ symbol }: { symbol: string }) {
  const { line, lanes } = useMarketLanes(symbol);
  if (!lanes) return <span className="search-lanes is-shut">{line.text}</span>;
  return (
    <span className="search-lanes tnum">
      {lanes.map((l, i) => (
        <span key={l.cadence} className={cn("search-lane", !l.open && "is-locked")}>
          <b>{l.label}</b> {i === 0 && l.open ? `closes in ${l.clock}` : l.open ? l.clock : `opens ${l.clock}`}
        </span>
      ))}
    </span>
  );
}

const nameOf = (symbol: string) => MARKETS.find((m) => m.symbol === symbol);

export function MarketBody({ symbol, onOptions }: { symbol: string; onOptions: () => void }) {
  const m = nameOf(symbol);
  const day = useDayLine(symbol);
  return (
    <>
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <span className="search-copy">
        <span className="search-title">{symbol}</span>
        <span className="search-sub">
          {m?.name}
          {m ? ` · ${KIND_WORDS[m.kind].label}` : ""}
        </span>
        <LaneStrip symbol={symbol} />
      </span>
      {day ? (
        <Sparkline symbol={symbol} day={day} className="search-spark h-6 w-18 sm:h-6 sm:w-18" />
      ) : (
        <span className="search-spark h-6 w-18" />
      )}
      <span className="search-figures">
        <LivePrice symbol={symbol} className="search-price" />
        <DayChangeText symbol={symbol} />
      </span>
      <button
        type="button"
        className="search-options"
        aria-label={`${symbol} options`}
        title={`${symbol} options`}
        onPointerDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onOptions();
        }}
      >
        <ChevronRight aria-hidden />
      </button>
    </>
  );
}

/** A lane, or Up / Down / Ride found directly ("btc 5m", "sol up"): compact, with the lane's moment. */
export function MarketActionBody({ entry }: { entry: SearchEntry }) {
  const symbol = entry.symbol ?? "";
  const lane = entry.target.kind === "terminal" ? entry.target.intent.lane : undefined;
  const { line, lanes } = useMarketLanes(symbol);
  const cell = lanes?.find((l) => l.cadence === lane);
  const state = cell
    ? cell.open
      ? `Closes in ${cell.clock}`
      : `Opens in ${cell.clock}`
    : lanes
      ? entry.subtitle
      : line.text;
  return (
    <>
      <EntityMark id={marketId(symbol)} size={MARK_SMALL} decorative />
      <span className="search-copy">
        <span className="search-title">{entry.title}</span>
        <span className="search-sub tnum">{state}</span>
      </span>
      <span className="search-figures">
        <LivePrice symbol={symbol} className="search-price is-small" />
      </span>
    </>
  );
}
