"use client";
/**
 * A basket's members under the terminal (S7.5, D-286): each one's mark, weight, move since the basket was 1,000 points
 * and what it adds to the basket now — the same per-member term `BasketPrintVerifier` sums. One row per member, each on
 * its own live price (lists render at most once a frame). Nothing for a single market.
 */
import { basketOf, memberLine } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { EntityMark } from "@/components/identity/entity-mark";
import { cn } from "@/lib/utils";

const MARK = 24;
const TONE = { up: "text-up", down: "text-down", muted: "text-text-3" } as const;

function MemberRow({ member }: { member: ReturnType<typeof basketOf>[number] }) {
  const priceE8 = useLivePrice(member.symbol);
  const line = memberLine(member, priceE8);
  return (
    <li className="flex min-h-10 items-center gap-3">
      <EntityMark id={marketId(member.symbol)} size={MARK} decorative />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="font-semibold text-row">{member.symbol}</span>
        <span className="text-meta text-text-3">{line.weight}</span>
      </span>
      <span className={cn("tnum text-meta", TONE[line.tone])}>{line.move ?? "—"}</span>
      <span className="tnum w-24 text-right font-semibold text-meta">{line.points ?? "—"}</span>
    </li>
  );
}

export function BasketMembers({ symbol }: { symbol: string }) {
  const members = basketOf(symbol);
  if (members.length === 0) return null;
  return (
    <section aria-label="In this basket" className="flex flex-col gap-1">
      <h3 className="font-semibold text-meta text-text-2">In this basket · started at 1,000 pts</h3>
      <ul className="flex flex-col">
        {members.map((m) => (
          <MemberRow key={m.symbol} member={m} />
        ))}
      </ul>
    </section>
  );
}
