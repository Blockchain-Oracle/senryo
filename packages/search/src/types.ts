/**
 * What search holds (R6.1): one entry per thing a person can find — a market, one of its lanes, an open position, an
 * event, a game, a place, an action, a help answer, a receipt a pasted id resolved to. Targets are platform-neutral;
 * each app turns a target into its own route, drawer or sheet.
 */
import type { CadenceSec } from "@senryo/config";

/** Groups in the order they read when scores tie; a query orders them by their best hit (R6.2). */
export const SEARCH_GROUPS = [
  "receipts",
  "positions",
  "markets",
  "lanes",
  "events",
  "games",
  "places",
  "actions",
  "help",
] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const GROUP_LABEL: Record<SearchGroup, string> = {
  receipts: "Receipts",
  positions: "Your positions",
  markets: "Markets",
  lanes: "Lanes",
  events: "Events",
  games: "Games",
  places: "Go to",
  actions: "Actions",
  help: "Help",
};

/** How the terminal should open: its market, and optionally the lane, Call or Ride, and a side to have ready. */
export interface TerminalIntent {
  symbol: string;
  lane?: CadenceSec;
  instrument?: "call" | "ride";
  side?: "up" | "down";
  /** A book key (`call:1019`, `ride:18`): the terminal opens that position with Cash out ready, never cashing out. */
  position?: string;
}

/** Things search can do without moving money (⌘K never executes a trade, Mitoshi RV-09). */
export const SEARCH_ACTIONS = [
  "add-money",
  "receive",
  "withdraw",
  "balances",
  "sound",
  "haptics",
  "theme",
  "tour",
  "one-tap",
] as const;
export type SearchAction = (typeof SEARCH_ACTIONS)[number];

export type SearchTarget =
  | { kind: "terminal"; intent: TerminalIntent }
  /** The market's own page of actions (Up, Down, Ride, lanes, proof) — a nested page in the palette. */
  | { kind: "market"; symbol: string }
  | { kind: "receipt"; of: "call" | "ride"; id: string }
  | { kind: "window"; windowId: string }
  | { kind: "event"; eventId: string }
  /** A nav key both apps know (`games`, `parlay`, `earn` …) or a game's key (`line-rider`). */
  | { kind: "place"; key: string }
  | { kind: "action"; action: SearchAction }
  | { kind: "help"; key: string }
  /** A hash no Senryo trade carries: its page on the explorer. */
  | { kind: "explorer"; hash: string };

export interface SearchEntry {
  /** Stable across sessions (`market:BTC`, `place:earn`, `event:0x…`): visits and recents key on it. */
  id: string;
  group: SearchGroup;
  title: string;
  /** A ticker or short code that ranks first when typed exactly. */
  symbol?: string;
  subtitle?: string;
  /** Words that find it without showing (`deposit`, `fund` on Add money). */
  keywords?: readonly string[];
  /** Shown only when the query asks for it (a lane needs a lane word); never in the empty view. */
  hidden?: boolean;
  target: SearchTarget;
}

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

export interface SearchSection {
  /** The group for a query's sections; `top`, `recent`, `hot` and the like where a section mixes kinds. */
  key: string;
  label: string;
  hits: SearchHit[];
  /** How many more there are than shown ("View all 7 positions"). */
  more?: number;
}
