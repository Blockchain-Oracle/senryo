"use client";
/**
 * Calls (the phone's Calls, S5): every call this account made, newest first, in the shared words (`@senryo/core`
 * `call-format.ts`). The record, the filters and the receipt drawer join with S6.6.
 */
import { lane, sideName, signedUsd, stateWord, toneOf, usd } from "@senryo/core";
import { useCalls } from "@senryo/query";
import { useAccount } from "@/lib/account/provider";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const TONE = { up: "text-up", down: "text-down", muted: "text-text-2" } as const;

export function CallsScreen() {
  const address = useAccount().hint?.address;
  const calls = useCalls(address);
  const hidden = usePrivacy();
  if (!address) return <p className="text-body text-text-2">Sign in to see your calls.</p>;
  if (calls.isError) return <p className="text-body text-text-2">Calls didn't load.</p>;
  if (!calls.data) return <p className="text-body text-text-3">Loading calls…</p>;
  const rows = calls.data.pages.flatMap((p) => p.calls);
  if (rows.length === 0) return <p className="text-body text-text-2">No calls yet. Make one on Trade.</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((c) => {
        const pnl = c.pnl === null ? null : BigInt(c.pnl);
        return (
          <li key={String(c.ticketId)} className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-row-title">
                {c.symbol} {sideName(c.band)} · {lane(c.cadenceSec)}
              </span>
              <span className="text-meta text-text-3">
                {masked(usd(c.stake), hidden)} · {stateWord(c)}
              </span>
            </span>
            <span className={cn("tnum font-semibold text-row-amount", TONE[toneOf(pnl)])}>
              {pnl === null ? "" : masked(signedUsd(pnl), hidden)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
