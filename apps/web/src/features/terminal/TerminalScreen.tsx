"use client";
/**
 * The terminal at `/app/trade/<symbol>/` (pivot S6.5): the whole stage is the workspace (`.terminal-surface` hides the
 * top line and the dock). This first cut shows the market and its live price; the canvas chart, the lanes, the odds,
 * the stake and Up/Down arrive with the Owarine port.
 */
import { formatPrice, priceFromE8 } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { EntityMark } from "@/components/identity/entity-mark";

const MARK = 40;

export function TerminalScreen({ symbol, name }: { symbol: string; name: string }) {
  const priceE8 = useLivePrice(symbol);
  return (
    <div className="terminal-surface flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <EntityMark id={marketId(symbol)} size={MARK} decorative />
        <div className="flex flex-col">
          <h1 className="font-semibold text-title">{symbol}</h1>
          <span className="text-meta text-text-3">{name}</span>
        </div>
      </div>
      <p className="tnum font-semibold text-display-price" aria-live="off">
        {formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8))}
      </p>
    </div>
  );
}
