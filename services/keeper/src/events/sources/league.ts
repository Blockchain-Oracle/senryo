import {
  easternDate,
  type FetchCache,
  fetchJson,
  finalLine,
  type GameReader,
  type GameRef,
  sameGame,
  secOf,
} from "../game.ts";

/**
 * The "League feed" member: each league's own keyless results feed — the NHL's game centre, MLB's Stats API and the
 * Premier League's fantasy API. The NFL publishes none without a key, so this member abstains on NFL games.
 */
const NHL = "https://api-web.nhle.com/v1/score";
const MLB = "https://statsapi.mlb.com/api/v1/schedule?sportId=1";
const FPL = "https://fantasy.premierleague.com/api";
const DAY_SEC = 86_400;
/** The NHL's own states for a game over: final, then official. */
const NHL_FINAL = new Set(["FINAL", "OFF"]);
/** A Premier League match is over once the full 90 minutes are played. */
const FPL_FULL_MINUTES = 90;

interface NhlSide {
  name: { default: string };
  score?: number;
}

async function nhlResult(game: GameRef, cache: FetchCache) {
  const url = `${NHL}/${easternDate(game.startSec)}`;
  const d = await fetchJson<{
    games?: { startTimeUTC: string; gameState: string; homeTeam: NhlSide; awayTeam: NhlSide }[];
  }>(cache, url);
  const g = d.games?.find((x) =>
    sameGame(game, secOf(x.startTimeUTC), x.homeTeam.name.default, x.awayTeam.name.default),
  );
  if (!g) return null;
  if (!NHL_FINAL.has(g.gameState) || g.homeTeam.score === undefined || g.awayTeam.score === undefined) {
    return { final: false as const };
  }
  const { score: home } = g.homeTeam;
  const { score: away } = g.awayTeam;
  return { final: true as const, home, away, source: url, read: finalLine(game, home, away) };
}

interface MlbSide {
  team: { name: string };
  score?: number;
}

async function mlbResult(game: GameRef, cache: FetchCache) {
  const day = easternDate(game.startSec);
  const next = easternDate(game.startSec + DAY_SEC);
  const url = `${MLB}&startDate=${day}&endDate=${next}`;
  const d = await fetchJson<{
    dates?: {
      games: {
        gameDate: string;
        status: { abstractGameState: string; detailedState: string };
        teams: { home: MlbSide; away: MlbSide };
      }[];
    }[];
  }>(cache, url);
  const g = d.dates
    ?.flatMap((x) => x.games)
    .find((x) => sameGame(game, secOf(x.gameDate), x.teams.home.team.name, x.teams.away.team.name));
  if (!g) return null;
  const over = g.status.abstractGameState === "Final" && !/postponed|cancel|suspend/i.test(g.status.detailedState);
  if (!over || g.teams.home.score === undefined || g.teams.away.score === undefined) return { final: false as const };
  const home = g.teams.home.score;
  const away = g.teams.away.score;
  return { final: true as const, home, away, source: url, read: finalLine(game, home, away) };
}

interface FplFixture {
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  finished_provisional: boolean;
  minutes: number;
}

async function fplResult(game: GameRef, cache: FetchCache) {
  const [boot, fixtures] = await Promise.all([
    fetchJson<{ teams: { id: number; name: string }[] }>(cache, `${FPL}/bootstrap-static/`),
    fetchJson<FplFixture[]>(cache, `${FPL}/fixtures/`),
  ]);
  const nameOf = new Map(boot.teams.map((t) => [t.id, t.name]));
  const f = fixtures.find(
    (x) =>
      x.kickoff_time !== null &&
      sameGame(game, secOf(x.kickoff_time), nameOf.get(x.team_h) ?? "", nameOf.get(x.team_a) ?? ""),
  );
  if (!f) return null;
  if (!f.finished_provisional || f.minutes < FPL_FULL_MINUTES || f.team_h_score === null || f.team_a_score === null) {
    return { final: false as const };
  }
  const home = f.team_h_score;
  const away = f.team_a_score;
  return { final: true as const, home, away, source: `${FPL}/fixtures/`, read: finalLine(game, home, away) };
}

export const leagueResult: GameReader = async (league, game, cache) => {
  if (!league.ownFeed) return null;
  if (league.key === "nhl") return nhlResult(game, cache);
  if (league.key === "mlb") return mlbResult(game, cache);
  if (league.key === "epl") return fplResult(game, cache);
  return null;
};
