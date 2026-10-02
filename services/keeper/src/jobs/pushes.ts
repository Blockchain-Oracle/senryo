import { expoClient, PushDelivery } from "@senryo/service-common";
import { INTERVALS_MS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Push outbox (G1, D7): delivers this network's queued notifications — the ones the api (social, starter money) and
 * the card service recorded, and the single retry of a keeper push whose first attempt failed. Rows are claimed by
 * event key, so this job and the keeper's inline attempt never send the same push twice; anything older than
 * PUSH_DELIVERY.freshSec is closed unsent. With PUSH_DELIVERY=off nothing is sent (rows stay in the inbox).
 */
export function pushOutboxJob(ctx: KeeperContext): Job {
  const expo = expoClient(ctx.env);
  const delivery = expo ? new PushDelivery(ctx.db, ctx.log, expo) : undefined;
  return {
    name: "pushes",
    intervalMs: INTERVALS_MS.pushes,
    async run() {
      if (!delivery) return;
      const counts = await delivery.deliverDue(ctx.chainId);
      if (Object.values(counts).some((n) => n > 0)) ctx.log.info(counts, "push outbox");
    },
  };
}
