import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { createDb, createHttpServer, createLogger, listen, migrate, pingDb, SessionKeys } from "@senryo/service-common";
import { CORS_METHODS, WS_MAX_PAYLOAD_BYTES } from "./constants.ts";
import { type ApiContext, openChains } from "./context.ts";
import { loadApiEnv } from "./env.ts";
import { GeoDb } from "./geo-db.ts";
import { EnvioIndexerBridge, NullIndexerBridge } from "./indexer.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { registerFollowRoutes } from "./routes/follow.ts";
import { registerInboxRoutes } from "./routes/inbox.ts";
import { registerInfoRoutes } from "./routes/info.ts";
import { registerProfileRoutes } from "./routes/profile.ts";
import { registerStarterRoutes } from "./routes/starter.ts";
import { registerStorageRoutes } from "./routes/storage.ts";
import { registerTopUpRoutes } from "./routes/topup.ts";
import { reconcilePendingRelays } from "./topup.ts";
import { WsHub } from "./ws.ts";

const { env, secrets } = loadApiEnv();
const log = createLogger("api", env.LOG_LEVEL);
const db = createDb(env.DATABASE_URL, "senryo-api");
await migrate(db, log);

const chains = await openChains(env, log);
const indexer = env.INDEXER_GRAPHQL_URL
  ? new EnvioIndexerBridge(env.INDEXER_GRAPHQL_URL, log)
  : new NullIndexerBridge();
indexer.start();
const geo = new GeoDb(log);
geo.start();
const ctx: ApiContext = {
  env,
  secrets,
  db,
  log,
  chains,
  sessions: secrets.sessionSecret ? new SessionKeys(secrets.sessionSecret) : undefined,
  indexer,
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
await app.register(websocket, { options: { maxPayload: WS_MAX_PAYLOAD_BYTES } });

registerInfoRoutes(app, ctx);
registerAuthRoutes(app, ctx);
registerStarterRoutes(app, ctx);
registerTopUpRoutes(app, ctx);
registerInboxRoutes(app, ctx);
registerStorageRoutes(app, ctx);
registerEngagementRoutes(app, ctx);
registerProfileRoutes(app, ctx);
registerFollowRoutes(app, ctx);
// Rows left non-terminal by a previous process (restart mid-claim) get their real stage; never re-sent (S8.16e).
void reconcilePendingRelays(ctx).catch((err) => log.warn({ err: String(err) }, "relay reconcile failed"));
const hub = new WsHub(ctx);
hub.register(app);
hub.start();

await listen(app, env.PORT, env.HOST, async () => {
  hub.stop();
  indexer.stop();
  geo.stop();
  for (const chain of chains.values()) await chain.heads.stop();
  await db.end();
});
