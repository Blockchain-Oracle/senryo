import Link from "next/link";
import { Num } from "@/components/shell/primitives";
import { ROUTES } from "@/lib/constants/routes";
import { amount, formatUnits, signed } from "@/lib/format";
import { POSITIONS } from "@/lib/sample";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-[minmax(0,1fr)_4rem_5rem_5rem] items-center gap-x-1";
const LIQ_DECIMALS = 1;
const BPS_DECIMALS = 2;

/** D2 positions table: market + side/leverage, size, liquidation, P&L. Rows open the market. */
export function PositionsTable({ className }: { className?: string }) {
  return (
    <div className={cn("border border-border", className)}>
      <div className={cn(GRID, "border-border border-b px-3 py-1.5 font-mono text-micro text-muted-foreground")}>
        <span>MKT</span>
        <span className="text-right">SIZE</span>
        <span className="text-right">LIQ</span>
        <span className="text-right">PNL</span>
      </div>
      {POSITIONS.map((p) => {
        const long = p.side === "LONG";
        const up = p.pnl6 >= 0n;
        const label = `${p.symbol} ${p.side.toLowerCase()}, ${p.lev}×, profit ${signed(p.pnl6)}, liquidation ${formatUnits(p.liqDistanceBps, BPS_DECIMALS, 0)}% away`;
        return (
          <Link
            key={p.symbol}
            href={ROUTES.trade(p.symbol)}
            aria-label={label}
            className={cn(
              GRID,
              "border-border border-b px-3 py-2.5 transition-colors duration-(--motion-fast) ease-desk last:border-0 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-mono font-semibold text-num-sm">{p.symbol}-PERP</span>
              <span className={cn("font-mono text-micro", long ? "text-up" : "text-down")}>
                {p.side} {p.lev}x{p.venue === "PERPL" ? " · PERPL" : ""}
              </span>
            </span>
            <Num className="text-right text-caption">{amount(p.size6, 0)}</Num>
            <Num className="text-right text-caption text-muted-foreground">{amount(p.liq6, LIQ_DECIMALS)}</Num>
            <Num className={cn("text-right text-caption", up ? "text-up" : "text-down")}>{signed(p.pnl6)}</Num>
          </Link>
        );
      })}
    </div>
  );
}
