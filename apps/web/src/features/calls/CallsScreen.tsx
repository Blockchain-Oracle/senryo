"use client";
import type { RowMark, RowOpen } from "@senryo/calls";
/**
 * Calls (the phone's Calls, S5.11): the record on this network (R5.20 `StatsCard`), then what's open
 * now, live (R5.3: the book's positions with Cash out), the parlays in play, and every call before it, newest first,
 * filtered All · Won · Lost · Refunded (outcome words, never colour alone; `@senryo/calls` `useCallRows`). Every row opens its receipt in the wide right drawer (`?d=call&id=…`, D-190).
 */
import { CALL_FILTERS, type CallFilter, type CallRow, filterRows, useCallRows, useLiveBook } from "@senryo/calls/react";
import { usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { Layers, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { OpenParlays } from "@/features/parlay/ParlayList";
import { PositionsPanel } from "@/features/positions/PositionsPanel";
import { useAppTrader } from "@/lib/account/guest";
import { tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import { StatsCard } from "./StatsCard";

const MARK = 36;
const TONE = { up: "text-up", down: "text-down", muted: "text-text-2" } as const;

const PLACE_ICON = { event: Trophy, parlay: Layers, duel: Swords } as const;

/** A market's own mark, or the place's nav icon (the rail's Trophy, Layers, Swords) in the same circle. */
function RowMarkView({ mark }: { mark: RowMark }) {
  if (mark.kind === "market") return <EntityMark id={marketId(mark.symbol)} size={MARK} decorative />;
  const Glyph = PLACE_ICON[mark.kind];
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary">
      <Glyph className="size-4" />
    </span>
  );
}

function Row({ row, hidden }: { row: CallRow; hidden: boolean }) {
  const router = useRouter();
  const title = row.title;
  const receipt = row.open.kind === "call" || row.open.kind === "ride";
  // A receipt opens in the wide drawer; an event call, parlay or duel opens where it lives (D1).
  const go = (o: RowOpen) => {
    switch (o.kind) {
      case "call":
        return openDrawer(DRAWERS.call, { id: String(o.id) });
      case "ride":
        return openDrawer(DRAWERS.ride, { id: String(o.id) });
      case "event":
        return router.push(`/app/event/?id=${o.eventId}`);
      case "parlay":
        return router.push("/app/parlay/");
      case "duel":
        return router.push("/app/duel/");
    }
  };
  return (
    <button
      type="button"
      className="flex min-h-16 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`${title}, ${row.status}, ${masked(row.result, hidden)}. ${receipt ? "Open the receipt" : "Open"}`}
      onClick={() => {
        tapFeedback();
        go(row.open);
      }}
    >
      <RowMarkView mark={row.mark} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-row-title">{title}</span>
        <span className="text-meta text-text-3">
          {row.tag} · {masked(usd(row.stake), hidden)} · {row.status}
        </span>
      </span>
      <span className={cn("tnum font-semibold text-row-title", TONE[row.tone])}>{masked(row.result, hidden)}</span>
    </button>
  );
}

export function CallsScreen() {
  const owner = useAppTrader().owner;
  const list = useCallRows(owner);
  const book = useLiveBook();
  const hidden = usePrivacy();
  const [filter, setFilter] = useState<CallFilter>("all");
  if (!owner)
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="font-semibold text-row-title">Your calls live here</p>
        <p className="text-body text-text-2">Every call, its result and its receipt.</p>
        <Button size="xl" onClick={() => openDrawer(DRAWERS.account)}>
          Create account
        </Button>
      </div>
    );
  // A failed or loading history keeps the open positions on screen (P2); only the history part waits or says so.
  const failed = list.failed && list.rows.length === 0;
  const holding = book.entries.length > 0 || book.parlays > 0;
  if (list.pending && list.rows.length === 0 && !holding)
    return <p className="text-body text-text-3">Loading calls…</p>;
  if (!failed && list.rows.length === 0 && !holding)
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="font-semibold text-row-title">No calls yet</p>
        <p className="text-body text-text-2">Call the next move on BTC, ETH or SOL.</p>
        <Button asChild size="xl">
          <Link href="/app/trade/btc/">Open the terminal</Link>
        </Button>
      </div>
    );
  const rows = filterRows(list.rows, filter);
  return (
    <div className="flex flex-col gap-5">
      <StatsCard owner={owner} hidden={hidden} />
      <PositionsPanel empty="none" />
      <OpenParlays owner={owner} />
      <SegmentedControl
        options={CALL_FILTERS}
        label="Show calls"
        value={filter}
        onValueChange={(v) => setFilter(v as CallFilter)}
        className="self-start"
      />
      {failed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body text-text-2">Your history didn't load.</p>
          <Button variant="secondary" onClick={list.retry}>
            Try again
          </Button>
        </div>
      ) : list.pending && list.rows.length === 0 ? (
        <p className="text-meta text-text-3">Loading calls…</p>
      ) : rows.length === 0 ? (
        <p className="text-meta text-text-3">None here yet.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.key}>
              <Row row={r} hidden={hidden} />
            </li>
          ))}
        </ul>
      )}
      {list.hasMore ? (
        <Button variant="ghost" onClick={list.loadMore} disabled={list.loadingMore} className="self-start">
          {list.loadingMore ? "Loading…" : "Show older calls"}
        </Button>
      ) : null}
    </div>
  );
}
