import type { LeagueKey, LeagueSpec } from "@senryo/config";
import { type EventTeam, MS_PER_SECOND } from "@senryo/service-common";
import { EVENT_SOURCE_TIMEOUT_MS, EVENT_START_SLACK_SEC } from "../constants.ts";

/**
 * A game as the keeper lists it and as each committee member looks it up (S8.7, D-296). ESPN's schedule names the game
 * (its id is the game's key); every source then finds it again on its own by the start and both teams' names, so no
 * member trusts another's ids.
 */
export interface GameRef {
  league: LeagueKey;
  /** ESPN's event id. */
  key: string;
  startSec: number;
  home: EventTeam;
  away: EventTeam;
}

/** What one source says of a game: over (with the score and the page it read), not over yet, or not found. */
export type GameResult =
  | { final: true; home: number; away: number; source: string; read: string }
  | { final: false }
  | null;

/** One member's reader for its own source; null where the source doesn't cover the league. */
export type GameReader = (league: LeagueSpec, game: GameRef, cache: FetchCache) => Promise<GameResult>;

/** One fetch per URL per run: several games on one date share a scoreboard. */
export type FetchCache = Map<string, Promise<unknown>>;

/** Plain on purpose: ESPN refuses agents that carry a URL. */
const BROWSER_AGENT = "SenryoCommittee/1.0";

export function fetchJson<T>(cache: FetchCache, url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;
  const p = (async () => {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": BROWSER_AGENT },
      signal: AbortSignal.timeout(EVENT_SOURCE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return (await res.json()) as T;
  })();
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

/** Names a source might shorten that no plain containment check catches (the Premier League's own feed). */
const ALIASES: Readonly<Record<string, string>> = {
  manutd: "manchesterunited",
  mancity: "manchestercity",
  spurs: "tottenhamhotspur",
  nottmforest: "nottinghamforest",
  wolves: "wolverhamptonwanderers",
  sheffieldutd: "sheffieldunited",
};

/** Lower case, accents and punctuation gone, aliases applied: "Montréal Canadiens" → "montrealcanadiens". */
export function teamKey(name: string): string {
  const k = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ALIASES[k] ?? k;
}

/** One source's name for a team against ESPN's full name: equal, or one contains the other ("Bruins" in "Boston Bruins"). */
export function sameTeam(a: string, b: string): boolean {
  const x = teamKey(a);
  const y = teamKey(b);
  return x.length > 0 && y.length > 0 && (x === y || x.includes(y) || y.includes(x));
}

/** The same game: the start within the slack and both sides the same way round. */
export function sameGame(game: GameRef, startSec: number, home: string, away: string): boolean {
  return (
    Math.abs(startSec - game.startSec) <= EVENT_START_SLACK_SEC &&
    sameTeam(home, game.home.name) &&
    sameTeam(away, game.away.name)
  );
}

/** Unix seconds of an ISO or RFC 2822 date. */
export const secOf = (date: string): number => Math.floor(Date.parse(date) / MS_PER_SECOND);

/** `2026-10-08T23:00:00Z`: an instant as theScore's ranges take it. */
export const isoOf = (sec: number): string => new Date(sec * MS_PER_SECOND).toISOString().replace(/\.\d{3}Z$/, "Z");

/** The calendar date in New York (US leagues file games under it; so does ESPN). */
export function easternDate(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(sec * MS_PER_SECOND));
}

/** The home side won: Yes. A draw or an away win: No. */
export const homeWon = (r: { home: number; away: number }) => r.home > r.away;

/** "final: Boston Bruins 6, Utah Mammoth 1" — what a member saw, in its statement. */
export const finalLine = (game: GameRef, home: number, away: number) =>
  `final: ${game.home.name} ${home}, ${game.away.name} ${away}`;
