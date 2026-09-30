import { Num } from "@/components/shell/primitives";
import { amount } from "@/lib/format";
import { CARD_HOLDS } from "@/lib/sample";
import { cn } from "@/lib/utils";

/** Kinpaku authorizations: holds reduce Free to spend until settled. */
export function CardAuths({ className }: { className?: string }) {
  return (
    <ul className={cn("border border-border font-mono text-caption", className)}>
      {CARD_HOLDS.map((h) => (
        <li
          key={h.merchant}
          className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center border-border border-b px-3 py-2.5 last:border-0"
        >
          <span className="truncate uppercase">{h.merchant}</span>
          <span className={h.status === "HOLD" ? "text-gold" : "text-muted-foreground"}>{h.status}</span>
          <Num className="text-right">-{amount(h.amount6)}</Num>
        </li>
      ))}
    </ul>
  );
}
