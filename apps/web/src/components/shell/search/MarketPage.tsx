"use client";
/**
 * A market's page inside search (R6.4, Codex direction 13; the rows are `@senryo/calls` `marketPageRows`, the phone's
 * own): Trade — Up, Down, Ride — each opening the terminal ready (never placing); Lanes — ↵ picks one here and moves
 * to Up; Market — its proof and its star. A local field narrows the rows.
 */
import { type MarketPageRow, marketPageRows, readSymbols, toggleFavourite } from "@senryo/calls";
import { useMarketLanes } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { marketId } from "@senryo/identity";
import type { TerminalIntent } from "@senryo/search";
import { Command } from "cmdk";
import { ArrowDown, ArrowUp, CornerDownLeft, ScrollText, Star, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { fire } from "@/lib/feedback";
import { TERMINAL_STORAGE, useStoredString } from "@/lib/terminal/stored";
import { cn } from "@/lib/utils";

const MARK = 32;
const SECTIONS = ["Trade", "Lanes", "Market"] as const;

export interface MarketPageState {
  symbol: string;
  lane?: CadenceSec;
}

function iconOf(row: MarketPageRow, symbol: string): ReactNode {
  switch (row.icon) {
    case "up":
      return <ArrowUp aria-hidden className="search-icon is-up" />;
    case "down":
      return <ArrowDown aria-hidden className="search-icon is-down" />;
    case "ride":
      return <TrendingUp aria-hidden className="search-icon" />;
    case "lane":
      return <EntityMark id={marketId(symbol)} size={MARK} decorative />;
    case "proof":
      return <ScrollText aria-hidden className="search-icon" />;
    case "star":
      return <Star aria-hidden className={cn("search-icon", row.on && "is-starred")} />;
  }
}

export function MarketPage({
  page,
  query,
  onLane,
  onOpen,
  onProof,
}: {
  page: MarketPageState;
  query: string;
  onLane: (lane: CadenceSec) => void;
  onOpen: (intent: TerminalIntent) => void;
  onProof: (symbol: string) => void;
}) {
  const { symbol } = page;
  const { line, lanes } = useMarketLanes(symbol);
  const [favRaw, setFavRaw] = useStoredString(TERMINAL_STORAGE.favourites);
  const favourites = readSymbols(favRaw);
  const rows = marketPageRows({
    symbol,
    lane: page.lane,
    lanes,
    lineText: line.text,
    starred: favourites.includes(symbol),
    query,
  });
  const run = (row: MarketPageRow) => {
    const act = row.act;
    switch (act.kind) {
      case "open":
        return onOpen(act.intent);
      case "lane":
        fire("tick");
        return onLane(act.lane);
      case "proof":
        return onProof(symbol);
      case "star":
        fire("tick", { cue: "toggle" });
        return setFavRaw(JSON.stringify(toggleFavourite(favourites, symbol)));
    }
  };
  return (
    <>
      {SECTIONS.map((section) => {
        const list = rows.filter((r) => r.section === section);
        return list.length === 0 ? null : (
          <Command.Group key={section} heading={<span className="search-heading">{section}</span>}>
            {list.map((row) => (
              <Command.Item
                key={row.id}
                value={row.id}
                disabled={row.disabled ?? false}
                onSelect={() => run(row)}
                className="search-row is-compact"
              >
                {iconOf(row, symbol)}
                <span className="search-copy">
                  <span className="search-title">{row.title}</span>
                  {row.sub ? <span className="search-sub tnum">{row.sub}</span> : null}
                </span>
                {row.icon === "lane" && row.on ? <span className="search-picked">Selected</span> : null}
                <span className="search-enter" aria-hidden>
                  <CornerDownLeft />
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        );
      })}
    </>
  );
}
