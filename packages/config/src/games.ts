/**
 * The games (S8.8, D-295): what the Games hub lists on both apps, each with whose money is at risk (Owarine's tags),
 * and the knobs the games share. Duel, Parlay and Events have their own places and are linked from the hub.
 */
export type GameKey = "lucky" | "warm-up" | "line-rider" | "candle-hop";

export interface GameSpec {
  key: GameKey;
  title: string;
  line: string;
  /** Whose money is at risk, in words. */
  stakes: string;
  /** The web path and the phone route. */
  href: string;
  route: string;
}

export const GAMES: readonly GameSpec[] = [
  {
    key: "lucky",
    title: "Lucky",
    line: "Spin for a market, a side and a reach",
    stakes: "One real call",
    href: "/app/games/lucky/",
    route: "/games/lucky",
  },
  {
    key: "warm-up",
    title: "Warm-up",
    line: "Five live cards against a coin flip",
    stakes: "No stakes",
    href: "/app/games/warm-up/",
    route: "/games/warm-up",
  },
  {
    key: "line-rider",
    title: "Line Rider",
    line: "Hug the line, build the combo",
    stakes: "No stakes · a board",
    href: "/app/games/line-rider/",
    route: "/games/line-rider",
  },
  {
    key: "candle-hop",
    title: "Candle Hop",
    line: "Tap through the candles",
    stakes: "No stakes · a board",
    href: "/app/games/candle-hop/",
    route: "/games/candle-hop",
  },
];

export const LUCKY_STAKES_USD = [1, 5, 10, 25] as const;
