import type { AccountSnapshot } from "@senryo/chain";
import { lockedOf } from "@/lib/account/balance";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

/** D2 three-cell bucket register (plan §2.4 one balance, three buckets) from the account's finalized snapshot. */
export function Register({ snapshot, className }: { snapshot: AccountSnapshot; className?: string }) {
  const cells = [
    { key: "FREE·TRADE", value: snapshot.freeToTrade, tone: "text-up", label: "Free to trade" },
    { key: "FREE·SPEND", value: snapshot.freeToSpend, tone: "text-gold", label: "Free to spend" },
    { key: "LOCKED", value: lockedOf(snapshot), tone: "text-muted-foreground", label: "Locked" },
  ] as const;
  return (
    <dl className={cn("grid grid-cols-3 divide-x divide-border border border-border", className)}>
      {cells.map((c) => (
        <div key={c.key} className="min-w-0 p-2.5">
          <dt className="truncate font-mono text-micro text-muted-foreground tracking-[0.16em]" title={c.label}>
            {c.key}
          </dt>
          <dd className={cn("truncate font-mono font-semibold text-body tnum", c.tone)}>{money(c.value, 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * D-010: Perpl equity is its own bucket and never counts toward Free to spend. Perpl isn't connected on the desk yet
 * (S7), so the row names the bucket and says when it fills — never a number it can't read.
 */
export function PerplBucket({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-between font-mono text-micro text-muted-foreground", className)}>
      <span className="tracking-[0.16em]">IN PERPL · NOT SPENDABLE</span>
      <span className="text-caption">With Perpl trading</span>
    </p>
  );
}
