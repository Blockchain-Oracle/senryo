"use client";
/**
 * The parlay's market picker (S8.5): the lane for new picks (1m · 5m · 15m · 1h), a search, then every market in its
 * kind groups with Up and Down — a pressed side is in the slip, pressing it again takes it out, the other side swaps
 * it. A market outside its session can't be picked (its window must trade).
 */
import { groupMarkets, PARLAY_SIDES, type ParlayPick } from "@senryo/calls";
import { useMarketLine } from "@senryo/calls/react";
import { CADENCES_SEC, type CadenceSec } from "@senryo/config";
import { laneLabel } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useCatalog } from "@senryo/query";
import { Search } from "lucide-react";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const MARK = 32;
const LANES = CADENCES_SEC.map((c) => ({ value: String(c), label: laneLabel(c) }));

function PickRow(p: { symbol: string; name: string; picked: ParlayPick | undefined; onPick: (band: number) => void }) {
  const line = useMarketLine(p.symbol);
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-1.5">
      <EntityMark id={marketId(p.symbol)} size={MARK} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row-title">{p.symbol}</span>
        <span className="truncate text-meta text-text-3">
          {p.name} · {line.text}
        </span>
      </span>
      {PARLAY_SIDES.map((side) => {
        const on = p.picked?.band === side.band;
        return (
          <button
            key={side.band}
            type="button"
            aria-pressed={on}
            disabled={!line.trading}
            aria-label={`${on ? "Remove" : "Add"} ${p.symbol} ${side.label}`}
            onClick={() => {
              fire("tick", { cue: "tap" });
              p.onPick(side.band);
            }}
            className={cn(
              "h-9 min-w-14 rounded-full px-3 font-semibold text-button-compact transition-colors duration-(--motion-fast)",
              "focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
              on ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
            )}
          >
            {side.label}
          </button>
        );
      })}
    </div>
  );
}

export function ParlayPicker(p: { picks: readonly ParlayPick[]; onPick: (pick: ParlayPick) => void }) {
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [lane, setLane] = useState<CadenceSec>(CADENCES_SEC[0]);
  const markets = "value" in catalog ? catalog.value.markets : [];
  const groups = groupMarkets(markets, query);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={LANES}
        label="Window for new picks"
        value={String(lane)}
        onValueChange={(v) => setLane(Number(v) as CadenceSec)}
        className="self-start"
      />
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
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col">
          <h2 className="px-3 pb-1 font-semibold text-section-title text-text-2">{g.label}</h2>
          {g.markets.map((m) => {
            const picked = p.picks.find((x) => x.symbol === m.symbol);
            return (
              <PickRow
                key={m.symbol}
                symbol={m.symbol}
                name={m.name}
                picked={picked}
                onPick={(band) => p.onPick({ symbol: m.symbol, cadenceSec: picked?.cadenceSec ?? lane, band })}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
