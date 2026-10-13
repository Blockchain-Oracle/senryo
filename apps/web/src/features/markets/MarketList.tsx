"use client";
/**
 * Every market on this network in its kind groups (S7.3): a search, the kind filter (the Calls filter's segmented
 * control), and per row (F7, research 10 §2: mark → symbol/name → 24 h graph → price and change → chevron, 72 px) the
 * real mark, symbol, its name with the market's own note ("Opens Mon 09:30 ET"; the shared 1-minute countdown is said
 * once above the list, `RoundClock`, D-348), the day's sparkline against the price 24 hours ago (D-319),
 * the price as it streams — the last print, dimmed, when closed — and its 24 h change. The whole row tints and lifts
 * on hover and opens the terminal. Prices re-render at most once a frame; the graph and change once a second.
 */
import { groupMarkets, MARKET_FILTERS, type MarketFilter, unitOf } from "@senryo/calls";
import { useDayLine, useMarketLine } from "@senryo/calls/react";
import { formatPrice, priceFromE8 } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { marketKeys, useCatalog } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ChangeChip } from "@/components/ui/change-chip";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sparkline } from "@/components/ui/sparkline";
import { tapFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { RoundClock } from "./RoundClock";

const MARK = 40;
const SKELETON_ROWS = 3;

export const tradeHref = (symbol: string) => `/app/trade/${symbol.toLowerCase()}/`;

export function MarketRow({
  symbol,
  name,
  selected = false,
  onPick,
  star,
}: {
  symbol: string;
  name: string;
  selected?: boolean;
  /** Runs as the row opens the terminal (the market picker records the recent and closes). */
  onPick?: () => void;
  /** A favourite toggle in place of the chevron (the market picker). */
  star?: { on: boolean; onToggle: () => void };
}) {
  const priceE8 = useLivePrice(symbol);
  const line = useMarketLine(symbol);
  const day = useDayLine(symbol);
  const price = formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8), undefined, unitOf(symbol));
  const link = (
    <Link
      href={tradeHref(symbol)}
      onClick={() => {
        tapFeedback();
        onPick?.();
      }}
      aria-current={selected ? "page" : undefined}
      aria-label={`${name}, ${price}. ${line.trading ? "" : `${line.text}. `}Open the terminal`}
      className={cn(
        "group press-lift flex min-h-18 min-w-0 flex-1 items-center rounded-xl py-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring",
        star ? "gap-2 px-2" : "gap-3 px-3",
        selected && "bg-selected-row",
      )}
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-row-title">{symbol}</span>
        <span className="truncate text-meta text-text-3">{line.note ? `${name} · ${line.note}` : name}</span>
      </span>
      {/* On a phone-width page, or in a narrow picker (under 24 rem), the name keeps the room the graph would take. */}
      {day ? (
        <Sparkline symbol={symbol} day={day} className={cn("shrink-0 max-sm:hidden", star && "@max-sm:hidden")} />
      ) : null}
      <span className="flex min-w-24 flex-col items-end gap-1">
        <span className={cn("tnum font-semibold text-row-price", !line.trading && "text-text-3")}>{price}</span>
        {day ? <ChangeChip symbol={symbol} day={day} suffix={false} /> : null}
      </span>
      {star ? null : (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-3 transition-transform duration-(--motion-fast) group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
  if (!star) return link;
  return (
    <div className="flex items-center gap-1">
      {link}
      <button
        type="button"
        onClick={star.onToggle}
        aria-pressed={star.on}
        aria-label={star.on ? `Remove ${symbol} from favourites` : `Add ${symbol} to favourites`}
        className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Star aria-hidden className={cn("size-4.5", star.on ? "fill-gold text-gold" : "text-text-3")} />
      </button>
    </div>
  );
}

export function MarketsLoading() {
  return (
    <div aria-busy className="flex flex-col gap-2">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md bg-skeleton" />
      ))}
    </div>
  );
}

export function MarketsFailed() {
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
  if (catalog.status === "failed") return <MarketsFailed />;
  if (!("value" in catalog)) return <MarketsLoading />;
  const groups = groupMarkets(catalog.value.markets, query, filter);
  return (
    <div className="flex flex-col gap-4">
      <search className="flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} />
        <SegmentedControl
          options={MARKET_FILTERS}
          label="Show markets"
          value={filter}
          onValueChange={(v) => setFilter(v as MarketFilter)}
          className="self-start"
        />
        <RoundClock />
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
