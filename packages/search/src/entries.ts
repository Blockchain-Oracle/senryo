/**
 * The entries both apps share (R6.1): every market with its hidden Up, Down, Ride and lanes (the market page's rows,
 * found directly by "btc up" or "eth 15m"); the games and play places; the actions that move no money; help. Places
 * come from each app's own nav, built here so they rank alike. Positions, events and receipts are built from live
 * reads where those are (`@senryo/calls/react`).
 */
import { type CadenceSec, type GameSpec, type HelpAnswer, type MarketKind, RIDE_MARKETS } from "@senryo/config";
import { laneLabel } from "@senryo/core";
import type { SearchAction, SearchEntry, TerminalIntent } from "./types.ts";

interface MarketLike {
  symbol: string;
  name: string;
  kind: MarketKind;
  cadences: readonly CadenceSec[];
}

/** A kind's label on a row and the words that find it. */
export const KIND_WORDS: Record<MarketKind, { label: string; words: readonly string[] }> = {
  crypto: { label: "Crypto", words: ["crypto", "coin", "token"] },
  equity: { label: "Stock", words: ["stock", "stocks", "share", "equity", "nasdaq"] },
  metal: { label: "Metal", words: ["metal", "metals", "commodity"] },
  fx: { label: "Currency", words: ["forex", "fx", "currency", "currencies"] },
  basket: { label: "Basket", words: ["basket", "index", "bundle"] },
};

const MINUTE = 60;
/** A lane's words as people type them: "5m", "5 min", "five minute". */
function laneWords(cadence: CadenceSec): string[] {
  const label = laneLabel(cadence);
  const minutes = cadence / MINUTE;
  return [label, `${minutes}min`, `${minutes}`, cadence >= MINUTE * MINUTE ? "hour" : "minute", "lane", "window"];
}

export const marketEntryId = (symbol: string): string => `market:${symbol}`;

/** Markets a ride can be opened on (D-299). */
const rides = new Set<string>(RIDE_MARKETS);

export function marketEntries(m: MarketLike): SearchEntry[] {
  const kind = KIND_WORDS[m.kind];
  const base = { symbol: m.symbol, keywords: kind.words } as const;
  const terminal = (intent: Omit<TerminalIntent, "symbol">) =>
    ({ kind: "terminal", intent: { symbol: m.symbol, ...intent } }) as const;
  return [
    {
      id: marketEntryId(m.symbol),
      group: "markets",
      title: m.name,
      subtitle: kind.label,
      ...base,
      keywords: [...kind.words, "trade", "chart", "price"],
      target: terminal({}),
    },
    {
      id: `up:${m.symbol}`,
      group: "markets",
      hidden: true,
      title: `${m.name} · Up`,
      subtitle: "Open the terminal with Up ready",
      ...base,
      keywords: ["up", "call", "higher", "long", "buy"],
      target: terminal({ instrument: "call", side: "up" }),
    },
    {
      id: `down:${m.symbol}`,
      group: "markets",
      hidden: true,
      title: `${m.name} · Down`,
      subtitle: "Open the terminal with Down ready",
      ...base,
      keywords: ["down", "call", "lower", "short", "sell"],
      target: terminal({ instrument: "call", side: "down" }),
    },
    ...(rides.has(m.symbol)
      ? [
          {
            id: `ride:${m.symbol}`,
            group: "markets",
            hidden: true,
            title: `${m.name} · Ride`,
            subtitle: "Ride the price with leverage",
            ...base,
            keywords: ["ride", "leverage", "long", "short", "perp"],
            target: terminal({ instrument: "ride" }),
          } satisfies SearchEntry,
        ]
      : []),
    ...m.cadences.map(
      (c): SearchEntry => ({
        id: `lane:${m.symbol}:${c}`,
        group: "lanes",
        hidden: true,
        title: `${m.name} · ${laneLabel(c)}`,
        subtitle: `${laneLabel(c)} windows`,
        ...base,
        keywords: laneWords(c),
        target: terminal({ lane: c, instrument: "call" }),
      }),
    ),
  ];
}

/** Play places that aren't in `GAMES` (they have their own pages): their copy as the web's Everything gives it. */
const PLAY = [
  {
    key: "parlay",
    title: "Parlay",
    line: "Two to four calls that must all come true; the odds multiply.",
    words: ["combo", "accumulator", "multi", "legs", "chain"],
  },
  {
    key: "duel",
    title: "Duel",
    line: "Head to head: three live markets, the better total takes the pot.",
    words: ["versus", "pvp", "match", "head", "opponent", "arena"],
  },
] as const;

export function gameEntries(games: readonly GameSpec[]): SearchEntry[] {
  return [
    ...games.map(
      (g): SearchEntry => ({
        id: `game:${g.key}`,
        group: "games",
        title: g.title,
        subtitle: g.line,
        keywords: [g.stakes, "game", "play", "arcade"],
        target: { kind: "place", key: g.key },
      }),
    ),
    ...PLAY.map(
      (p): SearchEntry => ({
        id: `game:${p.key}`,
        group: "games",
        title: p.title,
        subtitle: p.line,
        keywords: [...p.words, "game", "play"],
        target: { kind: "place", key: p.key },
      }),
    ),
    {
      id: "game:events",
      group: "events",
      title: "Events",
      subtitle: "Yes or No on real games, settled by a named committee.",
      keywords: ["sports", "football", "soccer", "hockey", "baseball", "nhl", "mlb", "nfl", "premier", "league"],
      target: { kind: "place", key: "events" },
    },
  ];
}

export interface PlaceLike {
  key: string;
  label: string;
  description?: string;
  keywords?: string;
}

/** Places the games group already holds (one row each). */
const PLAY_KEYS = new Set<string>([...PLAY.map((p) => p.key), "events"]);

export function placeEntries(places: readonly PlaceLike[]): SearchEntry[] {
  return places
    .filter((p) => !PLAY_KEYS.has(p.key))
    .map((p) => ({
      id: `place:${p.key}`,
      group: "places",
      title: p.label,
      ...(p.description ? { subtitle: p.description } : {}),
      keywords: p.keywords ? p.keywords.split(" ") : [],
      target: { kind: "place", key: p.key },
    }));
}

/** The settings an action shows the next state of ("Hide balances" while they show). */
export interface ActionState {
  practice: boolean;
  hidden: boolean;
  sound: boolean;
  haptics: boolean;
  /** Undefined where the app has no theme switch here. */
  light?: boolean;
  /** One-tap is on (signed in only; undefined for a guest). */
  oneTap?: boolean;
}

interface ActionCopy {
  title: string;
  subtitle?: string;
  keywords: readonly string[];
}

function actionCopy(action: SearchAction, s: ActionState): ActionCopy | null {
  switch (action) {
    case "add-money":
      return s.practice
        ? {
            title: "Get test dollars",
            subtitle: "Practice dollars and the daily top-up",
            keywords: ["add money", "deposit", "fund", "top up", "faucet", "balance", "test dollars", "free"],
          }
        : {
            title: "Add money",
            subtitle: "USDC to your Monad address",
            keywords: ["deposit", "fund", "top up", "add money", "usdc", "buy", "balance"],
          };
    case "receive":
      return { title: "Receive", subtitle: "Your Monad address and its QR", keywords: ["address", "qr", "copy"] };
    case "withdraw":
      return { title: "Withdraw", subtitle: "Send dollars to a Monad address", keywords: ["send", "transfer", "out"] };
    case "balances":
      return { title: s.hidden ? "Show balances" : "Hide balances", keywords: ["privacy", "hide", "show", "mask"] };
    case "sound":
      return { title: s.sound ? "Turn sounds off" : "Turn sounds on", keywords: ["sound", "mute", "audio", "music"] };
    case "haptics":
      return { title: s.haptics ? "Turn vibration off" : "Turn vibration on", keywords: ["vibration", "haptics"] };
    case "theme":
      return s.light === undefined
        ? null
        : { title: s.light ? "Use dark theme" : "Use light theme", keywords: ["dark", "light", "theme", "appearance"] };
    case "tour":
      return {
        title: "Take the tour",
        subtitle: "Five steps through the terminal",
        keywords: ["tutorial", "how", "learn", "guide", "help"],
      };
    case "one-tap":
      return s.oneTap === undefined
        ? null
        : {
            title: s.oneTap ? "Manage one-tap" : "Set up one-tap",
            subtitle: "Calls without a prompt each time, within a cap",
            keywords: ["one-tap", "session", "fast", "instant"],
          };
  }
}

export function actionEntries(actions: readonly SearchAction[], state: ActionState): SearchEntry[] {
  return actions.flatMap((action) => {
    const copy = actionCopy(action, state);
    return copy
      ? [{ id: `action:${action}`, group: "actions", ...copy, target: { kind: "action", action } } as SearchEntry]
      : [];
  });
}

export function helpEntries(answers: readonly HelpAnswer[]): SearchEntry[] {
  return answers.map((h) => ({
    id: `help:${h.key}`,
    group: "help",
    title: h.q,
    subtitle: h.a,
    target: { kind: "help", key: h.key },
  }));
}
