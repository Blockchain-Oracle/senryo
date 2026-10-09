"use client";
/**
 * Every market on this network (the phone's `MarketsScreen` rows, S5.10): the real mark, symbol and name, the price as
 * it streams, and the 1-minute window's countdown on the server's clock; a row opens the terminal there. Prices
 * re-render at most once a frame (lists, not the chart).
 */
import { CADENCES_SEC, LOCKOUT_SEC } from "@senryo/config";
import { clockText, formatPrice, laneLabel, priceFromE8, windowCountdown } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice, useServerSeconds } from "@senryo/live/react";
import { marketKeys, useCatalog } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { EntityMark } from "@/components/identity/entity-mark";
import { tapFeedback } from "@/lib/feedback";

const MARK = 40;
const FIRST_CADENCE = CADENCES_SEC[0];
const SKELETON_ROWS = 3;

export const tradeHref = (symbol: string) => `/app/trade/${symbol.toLowerCase()}/`;

function MarketRow({ symbol, name }: { symbol: string; name: string }) {
  const priceE8 = useLivePrice(symbol);
  const now = useServerSeconds();
  const w = windowCountdown(now, FIRST_CADENCE, LOCKOUT_SEC);
  const price = formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8));
  return (
    <Link
      href={tradeHref(symbol)}
      onClick={tapFeedback}
      aria-label={`${name}, ${price}. Open the terminal`}
      className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2 transition-colors duration-(--motion-fast) hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row-title">{symbol}</span>
        <span className="truncate text-meta text-text-3">
          {name} · {laneLabel(FIRST_CADENCE)}{" "}
          {w.open ? `closes in ${clockText(w.closesIn)}` : `calls reopen in ${clockText(w.endsIn)}`}
        </span>
      </span>
      <span className="tnum font-semibold text-row-price">{price}</span>
    </Link>
  );
}

export function MarketList() {
  const catalog = useCatalog();
  const client = useQueryClient();
  if (catalog.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body text-text-2">Markets didn't load.</p>
        <button
          type="button"
          onClick={() => void client.invalidateQueries({ queryKey: marketKeys.all })}
          className="rounded-md bg-secondary px-4 py-2 font-semibold text-button-compact"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!("value" in catalog)) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-skeleton" />
        ))}
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {catalog.value.markets.map((m) => (
        <li key={m.symbol}>
          <MarketRow symbol={m.symbol} name={m.name} />
        </li>
      ))}
    </ul>
  );
}
