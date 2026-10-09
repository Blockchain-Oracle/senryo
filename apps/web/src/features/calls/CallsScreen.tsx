"use client";
/**
 * Calls (the phone's Calls, S5.11): the record on this network (result, calls, won, lost, best streak), then what's open
 * now and every call before it, newest first, filtered All · Open · Won · Lost · Refunded (outcome words, never colour
 * alone; `@senryo/calls` `useCallRows`). Every row opens its receipt in the wide right drawer (`?d=call&id=…`, D-190).
 */
import { CALL_FILTERS, type CallFilter, type CallRow, filterRows, useCallRows } from "@senryo/calls/react";
import { lane, sideName, signedUsd, toneOf, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useCallerStats } from "@senryo/query";
import Link from "next/link";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccount } from "@/lib/account/provider";
import { tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const MARK = 36;
const TONE = { up: "text-up", down: "text-down", muted: "text-text-2" } as const;

function Row({ row, hidden }: { row: CallRow; hidden: boolean }) {
  const title = `${row.symbol} ${sideName(row.band)}`;
  return (
    <button
      type="button"
      className="flex min-h-16 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`${title}, ${row.status}, ${masked(row.result, hidden)}. Open the receipt`}
      onClick={() => {
        tapFeedback();
        openDrawer(DRAWERS.call, { id: String(row.ticketId) });
      }}
    >
      <EntityMark id={marketId(row.symbol)} size={MARK} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row-title">{title}</span>
        <span className="text-meta text-text-3">
          {lane(row.cadenceSec)} · {masked(usd(row.stake), hidden)} · {row.status}
        </span>
      </span>
      <span className={cn("tnum font-semibold text-row-title", TONE[row.tone])}>{masked(row.result, hidden)}</span>
    </button>
  );
}

function Record({ owner, hidden }: { owner: `0x${string}`; hidden: boolean }) {
  const stats = useCallerStats(owner);
  if (!("value" in stats) || stats.value.calls === 0) return null;
  const s = stats.value;
  const pnl = BigInt(s.pnl);
  return (
    <section aria-label="Your record" className="flex flex-col gap-1">
      <p className={cn("tnum font-semibold text-title", TONE[toneOf(pnl)])}>{masked(signedUsd(pnl), hidden)}</p>
      <p className="text-meta text-text-3">
        {s.calls} {s.calls === 1 ? "call" : "calls"} · {s.wins} won · {s.losses} lost · best streak {s.bestStreak}
      </p>
    </section>
  );
}

export function CallsScreen() {
  const owner = useAccount().hint?.address;
  const list = useCallRows(owner);
  const hidden = usePrivacy();
  const [filter, setFilter] = useState<CallFilter>("all");
  if (!owner)
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="font-semibold text-row-title">Your calls live here</p>
        <p className="text-body text-text-2">Every call, its result and its receipt.</p>
        <Button asChild size="xl">
          <Link href="/">Create account</Link>
        </Button>
      </div>
    );
  if (list.failed) return <p className="text-body text-text-2">Calls didn't load.</p>;
  if (list.pending && list.rows.length === 0) return <p className="text-body text-text-3">Loading calls…</p>;
  if (list.rows.length === 0)
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
      <Record owner={owner} hidden={hidden} />
      <SegmentedControl
        options={CALL_FILTERS}
        label="Show calls"
        value={filter}
        onValueChange={(v) => setFilter(v as CallFilter)}
        className="self-start"
      />
      {rows.length === 0 ? (
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
