import { fetchJson, finalLine, type GameReader, isoOf, sameGame, secOf } from "../game.ts";

/**
 * The "theScore" member: theScore's public scoreboard (no key), the games of a window around the start. A game is over
 * when its event status is final; scores come from its box score.
 */
const BASE = "https://api.thescore.com";
/** The window asked for, either side of the start: three hours. */
const WINDOW_SEC = 10_800;

interface ScoreSide {
  full_name: string;
}

interface ScoreEvent {
  game_date: string;
  event_status: string;
  home_team: ScoreSide;
  away_team: ScoreSide;
  box_score?: { score?: { home?: { score?: number }; away?: { score?: number } } };
}

export const thescoreResult: GameReader = async (league, game, cache) => {
  const range = `${isoOf(game.startSec - WINDOW_SEC)},${isoOf(game.startSec + WINDOW_SEC)}`;
  const url = `${BASE}/${league.thescore}/events?game_date.in=${range}`;
  const events = await fetchJson<ScoreEvent[]>(cache, url);
  const e = events.find((x) => sameGame(game, secOf(x.game_date), x.home_team.full_name, x.away_team.full_name));
  if (!e) return null;
  const home = e.box_score?.score?.home?.score;
  const away = e.box_score?.score?.away?.score;
  if (e.event_status !== "final" || home === undefined || away === undefined) return { final: false };
  return { final: true, home, away, source: url, read: finalLine(game, home, away) };
};
