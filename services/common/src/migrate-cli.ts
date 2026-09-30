import { z } from "zod";
import { createDb, migrate } from "./db.ts";
import { parseEnv } from "./env.ts";
import { createLogger } from "./logger.ts";

/** `pnpm --filter @senryo/service-common migrate` — apply pending migrations (each service also migrates on boot). */
const env = parseEnv(z.object({ DATABASE_URL: z.url() }));
const log = createLogger("migrate");
const db = createDb(env.DATABASE_URL, "senryo-migrate", 1);
try {
  const applied = await migrate(db, log);
  log.info({ applied }, applied.length ? "done" : "up to date");
} finally {
  await db.end();
}
