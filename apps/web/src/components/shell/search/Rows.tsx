"use client";
/**
 * Search's rows by kind (R6, Codex direction 13): one item per result inside cmdk, a neutral wash and a magenta ↵ tile
 * when highlighted. Positions read their live value and PnL from the book (masked while balances are hidden), events
 * show both crests and the score or start, Duel its live queue, places their key, actions their state. Nothing in a
 * row moves money.
 */

import type { EventView } from "@senryo/api-client";
import { positionHold } from "@senryo/calls";
import { useBookEntry } from "@senryo/calls/react";
import { longClockText, signedUsd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { useDuelWaiting, useEventBoard } from "@senryo/query";
import type { SearchEntry } from "@senryo/search";
import { Command } from "cmdk";
import {
  CircleHelp,
  CornerDownLeft,
  Eye,
  EyeOff,
  Gamepad2,
  type LucideIcon,
  Moon,
  Receipt,
  ScrollText,
  Sun,
  Vibrate,
  Volume2,
  Wallet,
  Zap,
} from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Odometer, viewDollars } from "@/components/ui/odometer";
import { TeamMark } from "@/features/events/TeamMark";
import { HIDDEN_AMOUNT, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import { NAV_ICON } from "../nav";
import { MarketActionBody, MarketBody } from "./MarketRows";

const MARK = 36;
const BPS_PER_PERCENT = 100;
const MS = 1_000;

function PositionBody({ entry }: { entry: SearchEntry }) {
  const key = entry.target.kind === "terminal" ? entry.target.intent.position : undefined;
  const e = useBookEntry(key);
  const now = useServerSeconds();
  const hidden = usePrivacy();
  if (!e) {
    return (
      <span className="search-copy">
        <span className="search-title">{entry.title}</span>
        <span className="search-sub">Closed</span>
      </span>
    );
  }
  const hold = positionHold(e);
  const left = e.endsAt === null ? null : Math.max(0, e.endsAt - now);
  const pnl = e.pnl;
  return (
    <>
      <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
      <span className="search-copy">
        <span className="search-title">{entry.title}</span>
        <span className="search-sub">{entry.subtitle}</span>
        <span className="search-sub tnum">{hold ?? (left === null ? "" : `Ends in ${longClockText(left)}`)}</span>
      </span>
      <span className="search-figures">
        <Odometer value={viewDollars(e.closeValue ?? e.worth)} sensitive className="search-price" />
        {pnl !== null ? (
          <span className={cn("search-change tnum", pnl > 0n ? "is-up" : pnl < 0n ? "is-down" : "is-flat")}>
            {hidden
              ? HIDDEN_AMOUNT
              : `${signedUsd(pnl)}${e.roiBps === null ? "" : ` · ${(e.roiBps / BPS_PER_PERCENT).toFixed(1)}%`}`}
          </span>
        ) : null}
      </span>
    </>
  );
}

const startText = (unixSec: number) =>
  new Date(unixSec * MS).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

function EventBody({ entry }: { entry: SearchEntry }) {
  const board = useEventBoard();
  const id = entry.target.kind === "event" ? entry.target.eventId.toLowerCase() : "";
  const ev: EventView | undefined =
    "value" in board ? board.value.events.find((x) => x.eventId.toLowerCase() === id) : undefined;
  if (!ev) {
    return (
      <span className="search-copy">
        <span className="search-title">{entry.title}</span>
        {entry.subtitle ? <span className="search-sub">{entry.subtitle}</span> : null}
      </span>
    );
  }
  const live = ev.live;
  return (
    <>
      <span className="search-crests">
        <TeamMark league={ev.league} team={ev.away} />
        <TeamMark league={ev.league} team={ev.home} />
      </span>
      <span className="search-copy">
        <span className="search-title is-wrap">{ev.question}</span>
        <span className="search-sub">
          {ev.away.abbr} @ {ev.home.abbr} · {ev.league}
        </span>
      </span>
      <span className="search-figures">
        {live && live.state !== "pre" && live.home !== null && live.away !== null ? (
          <>
            <span className="search-price tnum">
              {live.away}–{live.home}
            </span>
            <span className="search-sub">{live.detail}</span>
          </>
        ) : (
          <span className="search-sub tnum">
            {ev.state === "open" ? startText(ev.startsAt) : ev.state === "decided" ? "Decided" : "Void"}
          </span>
        )}
      </span>
    </>
  );
}

function DuelQueue() {
  const waiting = useDuelWaiting();
  if (!("value" in waiting)) return null;
  const n = [...waiting.value.values()].reduce((a, b) => a + b, 0);
  return <span className="search-state tnum">{n} waiting</span>;
}

const ACTION_ICON: Record<string, LucideIcon> = {
  "add-money": Wallet,
  receive: NAV_ICON.receive,
  withdraw: NAV_ICON.withdraw,
  tour: CircleHelp,
  "one-tap": Zap,
};

function iconOf(entry: SearchEntry): LucideIcon {
  const t = entry.target;
  if (t.kind === "place") return NAV_ICON[t.key as keyof typeof NAV_ICON] ?? Gamepad2;
  if (t.kind === "help") return CircleHelp;
  if (t.kind === "receipt" || t.kind === "explorer") return Receipt;
  if (t.kind === "window") return ScrollText;
  if (t.kind === "action") {
    if (t.action === "balances") return entry.title.startsWith("Show") ? Eye : EyeOff;
    if (t.action === "sound") return Volume2;
    if (t.action === "haptics") return Vibrate;
    if (t.action === "theme") return entry.title.includes("dark") ? Moon : Sun;
    return ACTION_ICON[t.action] ?? CircleHelp;
  }
  return Gamepad2;
}

/** An action's current state on the right ("On", "Off"): the title already says what choosing it does. */
function actionState(entry: SearchEntry): string | null {
  if (entry.target.kind !== "action") return null;
  if (entry.target.action === "sound" || entry.target.action === "haptics")
    return entry.title.endsWith("off") ? "On" : "Off";
  if (entry.target.action === "balances") return entry.title.startsWith("Show") ? "Hidden" : "Shown";
  return null;
}

function PlainBody({ entry, digit }: { entry: SearchEntry; digit?: string }) {
  const Icon = iconOf(entry);
  const state = actionState(entry);
  const help = entry.group === "help";
  return (
    <>
      {entry.symbol && entry.group === "receipts" ? (
        <EntityMark id={marketId(entry.symbol)} size={MARK} decorative />
      ) : (
        <Icon aria-hidden className="search-icon" />
      )}
      <span className="search-copy">
        <span className="search-title">{entry.title}</span>
        {entry.subtitle ? <span className={cn("search-sub", help && "is-two")}>{entry.subtitle}</span> : null}
      </span>
      {entry.target.kind === "place" && entry.target.key === "duel" ? <DuelQueue /> : null}
      {state ? <span className="search-state">{state}</span> : null}
      {digit ? <kbd className="search-digit">{digit}</kbd> : null}
    </>
  );
}

export function ResultRow({
  entry,
  digit,
  onSelect,
  onOptions,
}: {
  entry: SearchEntry;
  digit?: string;
  onSelect: () => void;
  onOptions: (symbol: string) => void;
}) {
  const t = entry.target;
  const market = entry.id.startsWith("market:");
  return (
    <Command.Item value={entry.id} onSelect={onSelect} className="search-row" data-group={entry.group}>
      {market && t.kind === "terminal" ? (
        <MarketBody symbol={t.intent.symbol} onOptions={() => onOptions(t.intent.symbol)} />
      ) : entry.group === "markets" || entry.group === "lanes" ? (
        <MarketActionBody entry={entry} />
      ) : entry.group === "positions" ? (
        <PositionBody entry={entry} />
      ) : entry.group === "events" && t.kind === "event" ? (
        <EventBody entry={entry} />
      ) : (
        <PlainBody entry={entry} {...(digit ? { digit } : {})} />
      )}
      <span className="search-enter" aria-hidden>
        <CornerDownLeft />
      </span>
    </Command.Item>
  );
}
