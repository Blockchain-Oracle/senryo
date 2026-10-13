"use client";
/**
 * The preview pane (R6.7, Codex direction 13; ≥ 1024 px): what the highlighted result is, at a glance — a market's
 * price, 24 h graph, four lanes and session; a position's live value, PnL and facts with "Cash out ready" (or why its
 * close is held); an event's crests, score and rules; a game's line; a help answer in full. It inspects, never acts.
 */
import { pnlText, positionClock, roiText, unitOf } from "@senryo/calls";
import { useBookEntry, useDayLine, useMarketLanes } from "@senryo/calls/react";
import { helpOn, MARKETS } from "@senryo/config";
import { formatPrice, priceFromE8, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { useEventBoard } from "@senryo/query";
import { KIND_WORDS, type SearchEntry } from "@senryo/search";
import { EntityMark } from "@/components/identity/entity-mark";
import { Odometer, viewDollars } from "@/components/ui/odometer";
import { Sparkline } from "@/components/ui/sparkline";
import { TeamMark } from "@/features/events/TeamMark";
import { HIDDEN_AMOUNT, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import { DayChangeText, LivePrice } from "./MarketRows";

const MARK = 40;
const PERCENT = 100;
const MS = 1_000;
const HELP = helpOn("web");

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="search-fact">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

function MarketPreview({ symbol }: { symbol: string }) {
  const m = MARKETS.find((x) => x.symbol === symbol);
  const day = useDayLine(symbol);
  const { line, lanes } = useMarketLanes(symbol);
  return (
    <>
      <div className="search-preview-head">
        <EntityMark id={marketId(symbol)} size={MARK} decorative />
        <div>
          <p className="search-preview-symbol">{symbol}</p>
          <p className="search-sub">
            {m?.name}
            {m ? ` · ${KIND_WORDS[m.kind].label}` : ""}
          </p>
        </div>
      </div>
      <LivePrice symbol={symbol} className="search-preview-price" />
      <DayChangeText symbol={symbol} suffix />
      {day ? (
        <Sparkline symbol={symbol} day={day} className="search-preview-chart h-36 w-full sm:h-36 sm:w-full" />
      ) : (
        <p className="search-preview-chart is-empty">24h chart unavailable</p>
      )}
      {lanes ? (
        <dl className="search-facts">
          {lanes.map((l) => (
            <Fact
              key={l.cadence}
              label={`${l.label} windows`}
              value={l.open ? `Closes in ${l.clock}` : `Opens in ${l.clock}`}
            />
          ))}
        </dl>
      ) : null}
      <p className="search-sub">{lanes ? (m?.calendarId === 0 ? "24/7" : line.text) : line.text}</p>
    </>
  );
}

function PositionPreview({ position }: { position: string }) {
  const e = useBookEntry(position);
  const now = useServerSeconds();
  const hidden = usePrivacy();
  if (!e) return <p className="search-sub">This position has closed.</p>;
  const unit = unitOf(e.symbol);
  const price = (v: bigint | null) => (v === null ? "—" : formatPrice(priceFromE8(Number(v)), undefined, unit));
  const money = (v: bigint | null) => (v === null ? "—" : hidden ? HIDDEN_AMOUNT : usd(v));
  const clock = positionClock(e, now);
  return (
    <>
      <div className="search-preview-head">
        <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
        <div>
          <p className="search-preview-symbol">
            {e.symbol} {e.label}
          </p>
          <p className="search-sub">{e.kind === "ride" ? "Ride" : "Call"}</p>
        </div>
      </div>
      <p className="search-sub">{e.closeValue === null ? "Estimated value" : "Live value"}</p>
      <Odometer value={viewDollars(e.closeValue ?? e.worth)} sensitive className="search-preview-price" />
      {e.pnl !== null ? (
        <p className={cn("search-change tnum", e.pnl > 0n ? "is-up" : e.pnl < 0n ? "is-down" : "is-flat")}>
          {hidden ? HIDDEN_AMOUNT : `${pnlText(e.pnl)}${e.roiBps === null ? "" : ` · ${roiText(e.roiBps)}`}`}
        </p>
      ) : null}
      <dl className="search-facts">
        <Fact label="Entry" value={price(e.entryE8)} />
        <Fact label="Now" value={price(e.markE8)} />
        <Fact label={e.kind === "ride" ? "Margin" : "Staked"} value={money(e.cost)} />
        <Fact label={e.kind === "ride" ? "Close value" : "Cash out value"} value={money(e.closeValue)} />
      </dl>
      <p className="search-preview-hint">{clock.live ? `${clock.text} · ↵ Open position` : clock.text}</p>
      <p className="search-sub">Review it on the terminal; nothing happens from here.</p>
    </>
  );
}

function EventPreview({ eventId }: { eventId: string }) {
  const board = useEventBoard();
  const ev =
    "value" in board ? board.value.events.find((x) => x.eventId.toLowerCase() === eventId.toLowerCase()) : undefined;
  if (!ev) return null;
  const pool = ev.yesPool + ev.noPool;
  const yes = pool > 0n ? Number((ev.yesPool * BigInt(PERCENT)) / pool) : null;
  return (
    <>
      <div className="search-preview-head">
        <TeamMark league={ev.league} team={ev.away} size="lg" />
        <TeamMark league={ev.league} team={ev.home} size="lg" />
      </div>
      <p className="search-preview-title">{ev.question}</p>
      <p className="search-sub">
        {ev.away.name} @ {ev.home.name} · {ev.league} ·{" "}
        {new Date(ev.startsAt * MS).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
      </p>
      {ev.live && ev.live.home !== null && ev.live.away !== null ? (
        <p className="search-preview-price tnum">
          {ev.live.away}–{ev.live.home} <span className="search-sub">{ev.live.detail}</span>
        </p>
      ) : null}
      {yes !== null ? (
        <p className="search-sub tnum">
          Called Yes {yes}% · No {PERCENT - yes}%
        </p>
      ) : null}
      <p className="search-sub is-clamp">{ev.rules}</p>
    </>
  );
}

export function Preview({ entry }: { entry: SearchEntry | undefined }) {
  if (!entry) return <aside className="search-preview" aria-hidden />;
  const t = entry.target;
  const help = t.kind === "help" ? HELP.find((h) => h.key === t.key) : undefined;
  return (
    <aside className="search-preview" aria-label="Preview">
      {t.kind === "terminal" && t.intent.position ? (
        <PositionPreview position={t.intent.position} />
      ) : t.kind === "terminal" ? (
        <MarketPreview symbol={t.intent.symbol} />
      ) : t.kind === "event" ? (
        <EventPreview eventId={t.eventId} />
      ) : help ? (
        <>
          <p className="search-preview-title">{help.q}</p>
          <p className="search-body">{help.a}</p>
        </>
      ) : (
        <>
          <p className="search-preview-title">{entry.title}</p>
          {entry.subtitle ? <p className="search-body">{entry.subtitle}</p> : null}
          {entry.group === "games" ? <p className="search-preview-hint">Opens the lobby. Start there.</p> : null}
        </>
      )}
    </aside>
  );
}
