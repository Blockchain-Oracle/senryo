/**
 * The Status board's memory (P6, D-324): once a minute, on the minute, each served network's component health goes into
 * `health_minutes` (one row per network and minute; a second api instance writing the same minute is a no-op). The
 * payload keeps each component's state and numbers, not its words. The keeper deletes rows after 90 days.
 */
import { jsonb } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { RECORD_EVERY_MS, SECONDS_PER_MINUTE } from "./constants.ts";
import { readHealth } from "./health.ts";

const MS_PER_SECOND = 1000;

export function startHealthRecorder(ctx: ApiContext): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const record = async () => {
    const minute = Math.floor(Date.now() / MS_PER_SECOND / SECONDS_PER_MINUTE);
    for (const chainId of ctx.chains.keys()) {
      try {
        const components = (await readHealth(ctx, chainId)).map(({ id, state, metrics }) => ({ id, state, metrics }));
        await ctx.db`INSERT INTO health_minutes (chain_id, minute, payload)
          VALUES (${chainId}, ${minute}, ${jsonb(ctx.db, { components })}) ON CONFLICT DO NOTHING`;
      } catch (error) {
        ctx.log.warn({ chainId, err: error instanceof Error ? error.message : String(error) }, "health not recorded");
      }
    }
  };
  const schedule = () => {
    // The next minute's first second, so every instance and restart lands on the same minute.
    const wait = RECORD_EVERY_MS - (Date.now() % RECORD_EVERY_MS) + MS_PER_SECOND;
    timer = setTimeout(() => {
      void record().finally(schedule);
    }, wait);
  };
  schedule();
  return () => {
    if (timer) clearTimeout(timer);
  };
}
