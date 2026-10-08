import { INTERVALS_MS, RETENTION_DAYS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Daily retention (S8.5b K9): nothing else deletes rows, and the api and keeper share one small Postgres.
 * Expired SIWE nonces go after a day; telemetry and push dedupe keys after their windows. Money state (calls, intents,
 * archived prints) is never purged here.
 */
export function retentionJob(ctx: KeeperContext): Job {
  return {
    name: "retention",
    intervalMs: INTERVALS_MS.retention,
    async run() {
      const d = RETENTION_DAYS;
      const counts = await Promise.all([
        ctx.db`DELETE FROM siwe_nonces WHERE expires_at < now() - make_interval(days => ${d.siweNonces})`,
        ctx.db`DELETE FROM latency_samples WHERE created_at < now() - make_interval(days => ${d.latency})`,
        ctx.db`DELETE FROM events WHERE created_at < now() - make_interval(days => ${d.events})`,
        ctx.db`DELETE FROM push_sends WHERE sent_at < now() - make_interval(days => ${d.pushSends})`,
      ]);
      ctx.log.info({ deleted: counts.map((c) => c.count) }, "retention sweep");
    },
  };
}
