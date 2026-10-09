"use client";
/**
 * Every market on this network in its kind groups (S7.3): a search, the kind filter (the Calls filter's segmented
 * control), and per row the real mark, symbol, the 1-minute window's countdown while the market trades or its session
 * in words while it doesn't ("Opens Mon 09:30 ET", `@senryo/calls` `marketLine`), and the price as it streams — the
 * last print, dimmed, when closed. A row opens the terminal. Prices re-render at most once a frame.
 */
import { groupMarkets, MARKET_FILTERS, type MarketFilter, unitOf } from "@senryo/calls";
import { useMarketLine } from "@senryo/calls/react";
import { formatPrice, priceFromE8 } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { marketKeys, useCatalog } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { tapFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const MARK = 40;
const SKELETON_ROWS = 3;

export const tradeHref = (symbol: string) => `/app/trade/${symbol.toLowerCase()}/`;

function MarketRow({ symbol, name }: { symbol: string; name: string }) {
  const priceE8 = useLivePrice(symbol);
  const line = useMarketLine(symbol);
  const price = formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8), undefined, unitOf(symbol));
  return (
    <Link
      href={tradeHref(symbol)}
      onClick={tapFeedback}
      aria-label={`${name}, ${price}. ${line.trading ? "" : `${line.text}. `}Open the terminal`}
      className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2 transition-colors duration-(--motion-fast) hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row-title">{symbol}</span>
        <span className="truncate text-meta text-text-3">
          {name} · {line.text}
        </span>
      </span>
      <span className={cn("tnum font-semibold text-row-price", !line.trading && "text-text-3")}>{price}</span>
    </Link>
  );
}

function Failed() {
  const client = useQueryClient();
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

export function MarketList() {
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketFilter>("all");
  if (catalog.status === "failed") return <Failed />;
  if (!("value" in catalog)) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-skeleton" />
        ))}
      </div>
    );
  }
  const groups = groupMarkets(catalog.value.markets, query, filter);
  return (
    <div className="flex flex-col gap-4">
      <search className="flex flex-col gap-3">
        <label className="flex h-12 items-center gap-3 rounded-full bg-secondary px-4">
          <Search aria-hidden className="size-4.5 shrink-0 text-text-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
            aria-label="Search markets"
            className="h-full w-full min-w-0 bg-transparent font-medium text-body outline-none placeholder:text-text-3"
          />
        </label>
        <SegmentedControl
          options={MARKET_FILTERS}
          label="Show markets"
          value={filter}
          onValueChange={(v) => setFilter(v as MarketFilter)}
          className="self-start"
        />
      </search>
      {groups.length === 0 ? (
        <p className="text-meta text-text-3">Nothing matches “{query}”.</p>
      ) : (
        groups.map((g) => (
          <section key={g.label} aria-label={g.label} className="flex flex-col gap-1">
            <h2 className="px-3 font-semibold text-section-title text-text-2">{g.label}</h2>
            <ul className="flex flex-col gap-1">
              {g.markets.map((m) => (
                <li key={m.symbol}>
                  <MarketRow symbol={m.symbol} name={m.name} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
