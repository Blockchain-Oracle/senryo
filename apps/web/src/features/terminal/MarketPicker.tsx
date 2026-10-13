"use client";
/**
 * The terminal's market picker (P2, D-321; the phone's market sheet), in the terminal's drawer: the search, the filter
 * chips — Favourites · Hot · All · Crypto · Stocks · Metals · FX · Baskets — then your recent markets on an empty
 * search and the kinds. Each row is the Markets row with a star; the current market is highlighted. The drawer unmounts
 * when it closes, so every open starts at All with an empty search. Favourites and recents stay on this device.
 */
import { PICKER_FILTERS, type PickerFilter, readSymbols, toggleFavourite } from "@senryo/calls";
import { useMarketPicker } from "@senryo/calls/react";
import { useCatalog } from "@senryo/query";
import { useMemo, useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { MarketRow, MarketsFailed, MarketsLoading } from "@/features/markets/MarketList";
import { RoundClock } from "@/features/markets/RoundClock";
import { fire } from "@/lib/feedback";
import { TERMINAL_STORAGE, useStoredString } from "@/lib/terminal/stored";

function emptyLine(filter: PickerFilter): string {
  if (filter === "favourites") return "No favourites yet. Tap a star to add one.";
  if (filter === "hot") return "The day's moves arrive with the next price update.";
  return "No markets match that search.";
}

interface PickerMarket {
  symbol: string;
  name: string;
  kind: string;
}

function Picker({
  markets,
  selected,
  onPick,
}: {
  markets: readonly PickerMarket[];
  selected: string;
  onPick: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PickerFilter>("all");
  const [favRaw, setFavRaw] = useStoredString(TERMINAL_STORAGE.favourites);
  const favourites = useMemo(() => readSymbols(favRaw), [favRaw]);
  const sections = useMarketPicker(markets, { query, filter, favourites });
  return (
    <div className="@container flex flex-col gap-4">
      <search className="flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} />
        <div role="tablist" aria-label="Show markets" className="terminal-lanes">
          {PICKER_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={f.value === filter}
              className="terminal-lane"
              onClick={() => {
                if (f.value === filter) return;
                fire("tick", { cue: "tap" });
                setFilter(f.value);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <RoundClock />
      </search>
      {sections.length === 0 ? (
        <p className="py-6 text-center text-body text-text-3">{emptyLine(filter)}</p>
      ) : (
        sections.map((s) => (
          <section key={s.label} aria-label={s.label} className="flex flex-col gap-1">
            <h2 className="px-3 font-semibold text-section-title text-text-2">{s.label}</h2>
            <ul className="flex flex-col gap-1">
              {s.markets.map((m) => (
                <li key={m.symbol}>
                  <MarketRow
                    symbol={m.symbol}
                    name={m.name}
                    selected={m.symbol === selected}
                    onPick={onPick}
                    star={{
                      on: favourites.includes(m.symbol),
                      onToggle: () => {
                        fire("tick", { cue: "tap" });
                        setFavRaw(JSON.stringify(toggleFavourite(favourites, m.symbol)));
                      },
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export function MarketPicker({ selected, onPick }: { selected: string; onPick: () => void }) {
  const catalog = useCatalog();
  if (catalog.status === "failed") return <MarketsFailed />;
  if (!("value" in catalog)) return <MarketsLoading />;
  return <Picker markets={catalog.value.markets} selected={selected} onPick={onPick} />;
}
