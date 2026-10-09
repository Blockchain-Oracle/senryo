/**
 * 21st:astralyxdev/odds-display (#36173), retokenized: a selectable price showing what $1 returns, with an arrow when
 * it has drifted out (pays more) or shortened (pays less) since a reference — flagged, never animated (a flashing slip
 * is unusable when several legs move at once). Changes from the source: decimal only (Senryo says "pays 1.92×"),
 * "—" when not priced, the project's tokens.
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const ODDS_DECIMALS = 2;

export function OddsDisplay({
  label,
  odds,
  previousOdds,
  selected = false,
  onSelect,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onSelect"> & {
  label?: ReactNode;
  /** What $1 returns; null when not priced. */
  odds: number | null;
  previousOdds?: number | null | undefined;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const shown = odds === null ? null : odds.toFixed(ODDS_DECIMALS);
  const before = previousOdds == null ? null : previousOdds.toFixed(ODDS_DECIMALS);
  const drifted = shown !== null && before !== null && shown !== before;
  const out = drifted && Number(shown) > Number(before);
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={odds === null}
      onClick={onSelect}
      className={cn(
        "flex min-w-20 flex-col items-center gap-0.5 rounded-md px-3 py-2 transition-colors duration-(--motion-fast)",
        "focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    >
      {label ? (
        <span className={cn("truncate text-meta", selected ? "opacity-80" : "text-text-3")}>{label}</span>
      ) : null}
      <span className="tnum flex items-center gap-1 font-semibold text-row-title">
        {shown === null ? "—" : `${shown}×`}
        {drifted && out ? <ArrowUp className="size-3 text-up" aria-label="pays more than when picked" /> : null}
        {drifted && !out ? <ArrowDown className="size-3 text-down" aria-label="pays less than when picked" /> : null}
      </span>
    </button>
  );
}
