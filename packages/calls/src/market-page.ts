/**
 * A market's page in search (R6.4, Codex direction 13), one copy for both apps: Trade — Up, Down (on the picked lane)
 * and Ride — each opening the terminal ready, never placing; Lanes — the four with their moment, picked here; Market —
 * its proof and its star. A closed market's trade rows say why; a market without rides says so. A query narrows rows.
 */
import type { CadenceSec } from "@senryo/config";
import type { TerminalIntent } from "@senryo/search";
import { ridesOn } from "./instrument.ts";
import type { LaneCell } from "./use-market-session.ts";

export type MarketPageAct =
  | { kind: "open"; intent: TerminalIntent }
  | { kind: "lane"; lane: CadenceSec }
  | { kind: "proof" }
  | { kind: "star" };

export interface MarketPageRow {
  id: string;
  section: "Trade" | "Lanes" | "Market";
  icon: "up" | "down" | "ride" | "lane" | "proof" | "star";
  title: string;
  sub?: string;
  disabled?: boolean;
  /** The picked lane; a starred market. */
  on?: boolean;
  act: MarketPageAct;
}

export function marketPageRows(o: {
  symbol: string;
  lane: CadenceSec | undefined;
  /** Null while the market doesn't trade; `lineText` says why. */
  lanes: readonly LaneCell[] | null;
  lineText: string;
  starred: boolean;
  query: string;
}): MarketPageRow[] {
  const { symbol, lane, lanes } = o;
  const picked = lane ? lanes?.find((l) => l.cadence === lane) : undefined;
  const on = picked ? ` · ${picked.label}` : "";
  const shut = lanes ? undefined : o.lineText;
  const withLane = lane ? { lane } : {};
  const rides = ridesOn(symbol);
  const rows: MarketPageRow[] = [
    {
      id: "page:up",
      section: "Trade",
      icon: "up",
      title: `Up${on}`,
      sub: shut ?? "Prepare an Up call",
      act: { kind: "open", intent: { symbol, instrument: "call", side: "up", ...withLane } },
    },
    {
      id: "page:down",
      section: "Trade",
      icon: "down",
      title: `Down${on}`,
      sub: shut ?? "Prepare a Down call",
      act: { kind: "open", intent: { symbol, instrument: "call", side: "down", ...withLane } },
    },
    {
      id: "page:ride",
      section: "Trade",
      icon: "ride",
      title: "Ride",
      sub: rides ? "Open the ride terminal" : "Rides unavailable on this market.",
      disabled: !rides,
      act: { kind: "open", intent: { symbol, instrument: "ride" } },
    },
    ...(lanes ?? []).map(
      (l): MarketPageRow => ({
        id: `page:lane:${l.cadence}`,
        section: "Lanes",
        icon: "lane",
        title: `${l.label} windows`,
        sub: l.open ? `Closes in ${l.clock}` : `Opens in ${l.clock}`,
        on: l.cadence === lane,
        act: { kind: "lane", lane: l.cadence },
      }),
    ),
    {
      id: "page:proof",
      section: "Market",
      icon: "proof",
      title: "View proof",
      sub: "Opening and closing price prints",
      act: { kind: "proof" },
    },
    {
      id: "page:star",
      section: "Market",
      icon: "star",
      title: o.starred ? `Remove ${symbol} from favourites` : `Add ${symbol} to favourites`,
      on: o.starred,
      act: { kind: "star" },
    },
  ];
  const q = o.query.trim().toLowerCase();
  return q ? rows.filter((r) => `${r.title} ${r.sub ?? ""} ${r.icon}`.toLowerCase().includes(q)) : rows;
}
