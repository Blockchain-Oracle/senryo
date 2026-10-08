import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createDb, createHttpServer, createLogger, listen, migrate, pingDb, SessionKeys } from "@senryo/service-common";
import { CORS_METHODS } from "./constants.ts";
import { type ApiContext, openChains } from "./context.ts";
import { loadApiEnv } from "./env.ts";
import { GeoDb } from "./geo-db.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { registerInfoRoutes } from "./routes/info.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";
import { registerProfileRoutes } from "./routes/profile.ts";
import { registerStorageRoutes } from "./routes/storage.ts";

/**
 * The api (D-256 pivot): sign-in, encrypted storage, push tokens and the notifications inbox, handles and profiles,
 * config/geo/status. S3 adds the Pyth gateway and the one multiplexed `/v1/stream`, the intent relayer, the Practice
 * grant and proof; S4 the indexer reads; S9 Aurora deposits (D-272).
 */
const { env, secrets } = loadApiEnv();
const log = createLogger("api", env.LOG_LEVEL);
const db = createDb(env.DATABASE_URL, "senryo-api");
await migrate(db, log);

const chains = await openChains(env, log);
const geo = new GeoDb(log);
geo.start();
const ctx: ApiContext = {
  env,
  secrets,
  db,
  log,
  chains,
  sessions: secrets.sessionSecret ? new SessionKeys(secrets.sessionSecret) : undefined,
  geo,
};
if (!ctx.sessions) log.warn("API_SESSION_SECRET unset — session routes answer 503");

const app = createHttpServer({
  service: "api",
  logger: log,
  ready: async () => ({
    db: await pingDb(db),
    ...Object.fromEntries([...chains.values()].map((c) => [`chain${c.chainId}`, c.heads.current().finalized > 0n])),
  }),
});
await app.register(cors, { origin: env.CORS_ORIGINS, methods: [...CORS_METHODS], credentials: false });
await app.register(rateLimit, { global: false });

registerInfoRoutes(app, ctx);
registerAuthRoutes(app, ctx);
registerStorageRoutes(app, ctx);
registerEngagementRoutes(app, ctx);
registerNotificationRoutes(app, ctx);
registerProfileRoutes(app, ctx);

await listen(app, env.PORT, env.HOST, async () => {
  geo.stop();
  for (const chain of chains.values()) await chain.heads.stop();
  await db.end();
});
