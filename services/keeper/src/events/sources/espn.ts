import type { LeagueSpec } from "@senryo/config";
import { easternDate, type FetchCache, fetchJson, finalLine, type GameReader, type GameRef, secOf } from "../game.ts";

/**
 * ESPN's public scoreboard (no key): the schedule the keeper lists from, and the "ESPN" member's results. One event
 * per game, its id the game's key; a final is completed with a final status (never a cancelled or abandoned one).
 */
const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const DAY_SEC = 86_400;

interface EspnTeam {
  displayName: string;
  abbreviation: string;
  logo?: string;
  logos?: { href: string }[];
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: EspnTeam;
  score?: string;
}

interface EspnCompetition {
  date: string;
  status: { type: { name: string; completed: boolean; state: string } };
  competitors: EspnCompetitor[];
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: EspnCompetition[];
}

/** A played-out game: completed and final (a cancelled or abandoned game is "completed" too, and must not count). */
const PLAYED = /^STATUS_(FINAL|FULL_TIME)/;
const dateParam = (sec: number) => easternDate(sec).replaceAll("-", "");
const logoOf = (t: EspnTeam) => t.logo ?? t.logos?.[0]?.href ?? null;

function sides(c: EspnCompetition) {
  const home = c.competitors.find((x) => x.homeAway === "home");
  const away = c.competitors.find((x) => x.homeAway === "away");
  return home && away ? { home, away } : null;
}

/** Games starting inside `[fromSec, toSec]` that haven't started, from the scoreboards of the dates they span. */
export async function espnSchedule(
  league: LeagueSpec,
  fromSec: number,
  toSec: number,
  cache: FetchCache,
): Promise<GameRef[]> {
  const dates = new Set<string>();
  for (let t = fromSec - DAY_SEC; t <= toSec + DAY_SEC; t += DAY_SEC) dates.add(dateParam(t));
  const games = new Map<string, GameRef>();
  for (const date of dates) {
    const board = await fetchJson<{ events?: EspnEvent[] }>(cache, `${BASE}/${league.espn}/scoreboard?dates=${date}`);
    for (const e of board.events ?? []) {
      const c = e.competitions[0];
      const s = c && sides(c);
      const startSec = secOf(e.date);
      if (!c || !s || c.status.type.state !== "pre" || startSec < fromSec || startSec > toSec) continue;
      games.set(e.id, {
        league: league.key,
        key: e.id,
        startSec,
        home: { name: s.home.team.displayName, abbr: s.home.team.abbreviation, logo: logoOf(s.home.team) },
        away: { name: s.away.team.displayName, abbr: s.away.team.abbreviation, logo: logoOf(s.away.team) },
      });
    }
  }
  return [...games.values()].sort((a, b) => a.startSec - b.startSec);
}

/** The "ESPN" member: the game by its id. */
export const espnResult: GameReader = async (league, game, cache) => {
  const url = `${BASE}/${league.espn}/summary?event=${game.key}`;
  const d = await fetchJson<{ header?: { competitions?: EspnCompetition[] } }>(cache, url);
  const c = d.header?.competitions?.[0];
  const s = c && sides(c);
  if (!c || !s) return null;
  if (!c.status.type.completed || !PLAYED.test(c.status.type.name)) return { final: false };
  const home = Number(s.home.score);
  const away = Number(s.away.score);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return { final: false };
  return { final: true, home, away, source: url, read: finalLine(game, home, away) };
};
