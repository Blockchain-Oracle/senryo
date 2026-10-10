import { randomBytes } from "node:crypto";
import type { Address } from "@senryo/chain";
import { type ArcadeGame, envelopeCheck, MAX_RUN_SEC, replayArcade, seedFromBytes } from "@senryo/core";
import {
  arcadeBestOf,
  arcadeBoard,
  type Db,
  insertArcadeScore,
  issueArcadeSeed,
  takeArcadeSeed,
} from "@senryo/service-common";
import { bad } from "../relay/gates.ts";

/**
 * The arcade's server half (S8.8, D-295; Owarine arcade/score.server.ts): a seed per run, issued here so a score can
 * only be for a run the api started, and a score accepted only when the replay of that seed and the recorded inputs
 * ends where the device said, on the score it said. Checked, not on chain; no money rides on it.
 */
const SEED_BYTES = 4;
/** A seed stays good for the longest run plus a few minutes to start it. */
const SEED_GRACE_SEC = 300;
/** The device's clock and the replay may round the last tick differently. */
const TICK_SLACK = 1;
export const ARCADE_BOARD_SIZE = 10;

export interface ArcadeRun {
  game: ArcadeGame;
  seed: string;
  calm: boolean;
  durationMs: number;
  trace: number[];
  score: number;
}

export class ArcadeDesk {
  constructor(private readonly db: Db) {}

  async seed(owner: Address, game: ArcadeGame): Promise<string> {
    const seed = seedFromBytes(randomBytes(SEED_BYTES));
    await issueArcadeSeed(this.db, seed, game, owner);
    return seed;
  }

  async submit(owner: Address, run: ArcadeRun): Promise<{ score: number; best: number }> {
    const envelope = envelopeCheck(run.game, run.durationMs, run.trace, run.score);
    if (!envelope.ok) throw bad(`run refused: ${envelope.why}`);
    if (!(await takeArcadeSeed(this.db, run.seed, run.game, owner, MAX_RUN_SEC + SEED_GRACE_SEC))) {
      throw bad("run refused: that seed isn't yours, was used, or expired");
    }
    const replay = replayArcade(run.game, run.seed, run.trace, { calm: run.calm });
    if (!replay.ended || replay.score !== run.score || Math.abs(replay.ticks - envelope.ticks) > TICK_SLACK) {
      throw bad("run refused: the replay doesn't reproduce that score");
    }
    await insertArcadeScore(this.db, { ...run, owner, ticks: replay.ticks });
    return { score: run.score, best: (await arcadeBestOf(this.db, run.game, owner)) ?? run.score };
  }

  board(game: ArcadeGame) {
    return arcadeBoard(this.db, game, ARCADE_BOARD_SIZE);
  }
}
