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
    line: "Ride the real chart · hop the gaps, land the flips",
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

/**
 * Line Rider's terrain (R7.2, D-318): the price tape the api records for a run — one of these markets at random, its
 * last day of 1-minute closes. A tape is cut on a 15-minute boundary, so the same few tapes serve every run in that
 * quarter hour and each is stored once.
 */
export const ARCADE_TAPE_SYMBOLS = ["BTC", "ETH", "SOL"] as const;
export const ARCADE_TAPE_MINUTES = 1_440;
export const ARCADE_TAPE_CUT_SEC = 900;
