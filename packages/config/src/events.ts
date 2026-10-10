/**
 * Yes/no events (D-296, `contracts/src/events/`): a question, the committee that answers it, Yes stakes against No
 * stakes. The committee here is Senryo-run on Practice — three signers, each reading a different public source, two
 * of whom must agree and none disagree — and says so wherever an event shows (D-296 labelling). Real has no events.
 */
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

const USD = 1_000_000n;
const HOUR_SEC = 3600;
const MINUTE_SEC = 60;

export const EVENTS = {
  /** A quorum waits this long for the rest of the committee: a dissent inside it voids the event (`dissentWaitSec`). */
  dissentWaitSec: 10 * MINUTE_SEC,
  /** The book's share of the losing side when the committee decides (`MAX_EVENT_FEE_BPS` caps it at 10 %). */
  feeBps: 200,
  /** A signed call stays good this long. */
  callTtlSec: 300,
  /** The keeper lists games starting within this. */
  listAheadSec: 36 * HOUR_SEC,
  /** An answer counts until this long after the start: a postponed game the committee can't call refunds after it. */
  answerSpanSec: 48 * HOUR_SEC,
  /** Stake presets in dollars; any exact amount within the book's limits can be typed. */
  stakePresetsUsd: [5, 10, 25, 100],
  /** Domain tag of a member's statement (Owarine's `agari-event-v1`, Senryo's own). */
  statementDomain: "senryo-event-v1",
} as const;

/** The book's stake limits per network; null = no events there. */
export const EVENT_LIMITS: Readonly<Record<ChainId, { minStake: bigint; maxStake: bigint } | null>> = {
  [TESTNET_CHAIN_ID]: { minStake: 1n * USD, maxStake: 1000n * USD },
  [MAINNET_CHAIN_ID]: null,
};

/** Who answers: what each signer reads, shown beside its address on every event. */
export interface CommitteeMember {
  address: `0x${string}`;
  name: string;
  /** The source family the signer reads, in words. */
  reads: string;
  source: EventSourceKey;
}

export interface CommitteeSpec {
  id: number;
  quorum: number;
  /** Who runs the signers, said beside the committee everywhere. */
  runBy: string;
  members: readonly CommitteeMember[];
}

export type EventSourceKey = "league" | "espn" | "thescore";

/** The keys are in the gitignored `.env.local` and the keeper's env (`EVENT_SIGNER_{1,2,3}_PK`), never in the tree. */
export const EVENT_COMMITTEES: Readonly<Record<ChainId, CommitteeSpec | null>> = {
  [TESTNET_CHAIN_ID]: {
    id: 1,
    quorum: 2,
    runBy: "Senryo",
    members: [
      {
        address: "0xC1Ce51ff6D7FAA5828d4F79C283d2E59bFb54DB9",
        name: "League feed",
        reads: "the league's own results feed",
        source: "league",
      },
      {
        address: "0x7AE4eD9435c5a201f6e991a6a3FAD6f143A3f190",
        name: "ESPN",
        reads: "ESPN's scoreboard",
        source: "espn",
      },
      {
        address: "0xeAC40F60b343329C747F1403910E27aEb091db34",
        name: "theScore",
        reads: "theScore's scoreboard",
        source: "thescore",
      },
    ],
  },
  [MAINNET_CHAIN_ID]: null,
};

/** A network's committee as the apps show it (who signs, what each reads); null where there are no events. */
export function committeeView(chainId: ChainId) {
  const c = EVENT_COMMITTEES[chainId];
  if (!c) return null;
  return {
    id: c.id,
    quorum: c.quorum,
    runBy: c.runBy,
    members: c.members.map((m) => ({ address: m.address, name: m.name, reads: m.reads, source: m.source })),
  };
}

export type LeagueKey = "nhl" | "mlb" | "nfl" | "epl";

export interface LeagueSpec {
  key: LeagueKey;
  name: string;
  /** ESPN's `sports/{sport}/{league}` path. */
  espn: string;
  /** theScore's league slug. */
  thescore: string;
  /** Whether the league publishes its own keyless results feed (the "League feed" signer abstains where it doesn't). */
  ownFeed: boolean;
  /** No game is over before this: answers count from the start plus this. */
  minGameSec: number;
  /** Whether a draw is possible (then it is No). */
  draws: boolean;
  /** The question asked about the home side. */
  question: (home: string, away: string) => string;
  /** The rule the committee answers by, in words. */
  rule: (home: string, away: string) => string;
}

const SETTLE_RULE =
  "Calls close at the scheduled start. If the game isn't played within two days or the signers disagree, every call is refunded.";

export const LEAGUES: readonly LeagueSpec[] = [
  {
    key: "nhl",
    name: "NHL",
    espn: "hockey/nhl",
    thescore: "nhl",
    ownFeed: true,
    minGameSec: 2 * HOUR_SEC,
    draws: false,
    question: (home, away) => `Will the ${home} beat the ${away}?`,
    rule: (home, away) =>
      `Yes if the ${home} win, overtime and shootout included. No if the ${away} win. ${SETTLE_RULE}`,
  },
  {
    key: "mlb",
    name: "MLB",
    espn: "baseball/mlb",
    thescore: "mlb",
    ownFeed: true,
    minGameSec: 2 * HOUR_SEC,
    draws: false,
    question: (home, away) => `Will the ${home} beat the ${away}?`,
    rule: (home, away) => `Yes if the ${home} win, extra innings included. No if the ${away} win. ${SETTLE_RULE}`,
  },
  {
    key: "nfl",
    name: "NFL",
    espn: "football/nfl",
    thescore: "nfl",
    ownFeed: false,
    minGameSec: 2 * HOUR_SEC + 45 * MINUTE_SEC,
    draws: true,
    question: (home, away) => `Will the ${home} beat the ${away}?`,
    rule: (home, away) => `Yes if the ${home} win, overtime included. A tie or a ${away} win is No. ${SETTLE_RULE}`,
  },
  {
    key: "epl",
    name: "Premier League",
    espn: "soccer/eng.1",
    thescore: "epl",
    ownFeed: true,
    minGameSec: HOUR_SEC + 50 * MINUTE_SEC,
    draws: true,
    question: (home, away) => `Will ${home} beat ${away}?`,
    rule: (home, away) =>
      `Yes if ${home} win in normal time (90 minutes plus stoppage). A draw or a ${away} win is No. ${SETTLE_RULE}`,
  },
];

export const leagueOf = (key: string): LeagueSpec | undefined => LEAGUES.find((l) => l.key === key);

/** The event's terms on chain, as the book lists them (`EventTerms`). */
export interface EventTermsSpec {
  closesAt: number;
  answerFrom: number;
  answerBy: number;
}

/** A game's terms: calls close at the start, answers count once it can be over and until the answer span ends. */
export function gameTerms(league: LeagueSpec, startSec: number): EventTermsSpec {
  return { closesAt: startSec, answerFrom: startSec + league.minGameSec, answerBy: startSec + EVENTS.answerSpanSec };
}
