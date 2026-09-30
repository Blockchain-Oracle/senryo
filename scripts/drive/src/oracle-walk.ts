import { contractCall, type ReadClient, readMarketRisk, type Sender, sendAndFinalize } from "@senryo/chain";
import { RISK } from "@senryo/core";
import { E18_TO_FEED } from "./constants.ts";
import { CHAIN } from "./lib.ts";

/** Oracle walk step, below the 200 bps clamp so every round is accepted. */
const WALK_STEP_BPS = 150n;
/** Hard stop (a 20 % move at 150 bps per round is ~15 rounds). */
const MAX_WALK_ROUNDS = 40;
const MIRROR = { 0: "MirrorXAU", 1: "MirrorXAG" } as const;

/**
 * Fork-only: move a market's accepted price to `target18` in sub-clamp steps (mirror push by the MIRROR_ROLE key, then
 * `SessionOracle.observe`), so the market stays OPEN. Mirror answers are 8-decimal.
 */
export async function walkTo(read: ReadClient, keeper: Sender, marketId: 0 | 1, target18: bigint): Promise<void> {
  for (let round = 0; round < MAX_WALK_ROUNDS; round += 1) {
    const cur = (await readMarketRisk(read, CHAIN, marketId)).pv.price18;
    const gap = target18 > cur ? target18 - cur : cur - target18;
    if (gap * RISK.BPS <= cur) return;
    const stepMax = (cur * WALK_STEP_BPS) / RISK.BPS;
    const next = gap <= stepMax ? target18 : target18 > cur ? cur + stepMax : cur - stepMax;
    await sendAndFinalize(
      keeper,
      contractCall(CHAIN, MIRROR[marketId], "pushAnswer", [next / E18_TO_FEED], "pushAnswer"),
    );
    await sendAndFinalize(keeper, contractCall(CHAIN, "SessionOracle", "observe", [marketId], "observe"));
  }
  throw new Error(`walkTo ${marketId}: oracle did not reach ${target18} in ${MAX_WALK_ROUNDS} rounds`);
}
