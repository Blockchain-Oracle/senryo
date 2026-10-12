import type { Hex } from "@senryo/chain";
import { feedIdOf, type MarketSpec, marketsOn, sigmaE8Of } from "@senryo/config";
import { SIGMA_MARK_STEP_SEC } from "@senryo/core";
import { archivedKeys, MS_PER_SECOND, marketOpenAt, printKey, sigmaMarkFor } from "@senryo/service-common";
import { SIGMA_AFTER_SEC, SIGMA_INTERVAL_MS, SIGMA_WAIT_SEC } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * σ marks (R4.3, D-313): every feed's mark through each minute boundary, into `sigma_marks` just after the minute —
 * as soon as its boundary print is archived, or `SIGMA_WAIT_SEC` in without one (a closed market carries its state).
 * A fill 5 s past the boundary already finds its mark; the relay computes any the keeper missed, and the stored row
 * wins either way. A minute missed while the keeper was down is rebuilt from the archive when it is next needed.
 */
export function sigmaJob(ctx: KeeperContext): Job {
  const markets = new Map<Hex, MarketSpec>();
  for (const m of marketsOn(ctx.chainId)) markets.set(feedIdOf(m), m);
  const written = new Map<Hex, number>();
  return {
    name: "sigma",
    intervalMs: SIGMA_INTERVAL_MS,
    async run() {
      const now = Date.now() / MS_PER_SECOND;
      const minute = Math.floor(now / SIGMA_MARK_STEP_SEC) * SIGMA_MARK_STEP_SEC;
      if (now < minute + SIGMA_AFTER_SEC) return;
      const due = [...markets.keys()].filter((f) => (written.get(f) ?? 0) < minute);
      if (due.length === 0) return;
      const printed =
        now < minute + SIGMA_WAIT_SEC
          ? await archivedKeys(
              ctx.db,
              due.map((feedId) => ({ feedId, t: minute })),
            )
          : undefined;
      for (const feedId of due) {
        if (printed && !printed.has(printKey(feedId, minute))) continue;
        const m = markets.get(feedId);
        if (!m) continue;
        await sigmaMarkFor(ctx.db, feedId, minute, sigmaE8Of(m), marketOpenAt(m));
        written.set(feedId, minute);
      }
    },
  };
}
