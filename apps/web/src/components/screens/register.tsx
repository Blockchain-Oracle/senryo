import { Num } from "@/components/shell/primitives";
import { usd } from "@/lib/format";
import { BALANCE } from "@/lib/sample";
import { cn } from "@/lib/utils";

const CELLS = [
  { key: "FREE·TRADE", value: BALANCE.freeToTrade6, tone: "text-up", label: "Free to trade" },
  { key: "FREE·SPEND", value: BALANCE.freeToSpend6, tone: "text-gold", label: "Free to spend" },
  { key: "LOCKED", value: BALANCE.locked6, tone: "text-muted-foreground", label: "Locked" },
] as const;

/** D2 three-cell bucket register (plan §2.4 one balance, three buckets). */
export function Register({ className }: { className?: string }) {
  return (
    <dl className={cn("grid grid-cols-3 divide-x divide-border border border-border", className)}>
      {CELLS.map((c) => (
        <div key={c.key} className="min-w-0 p-2.5">
          <dt className="truncate font-mono text-micro text-muted-foreground tracking-[0.16em]" title={c.label}>
            {c.key}
          </dt>
          <dd className={cn("font-mono font-semibold text-body tnum", c.tone)}>{usd(c.value, 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** D-010: Perpl equity is its own bucket and never counts toward Free to spend. */
export function PerplBucket({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-between font-mono text-micro text-muted-foreground", className)}>
      <span className="tracking-[0.16em]">IN PERPL · NOT SPENDABLE</span>
      <Num className="text-caption text-foreground">{usd(BALANCE.inPerpl6, 0)}</Num>
    </p>
  );
}
