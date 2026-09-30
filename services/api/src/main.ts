import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { createDb, createHttpServer, createLogger, listen, migrate, pingDb, SessionKeys } from "@senryo/service-common";
import { WS_MAX_PAYLOAD_BYTES } from "./constants.ts";
import { type ApiContext, openChains } from "./context.ts";
import { loadApiEnv } from "./env.ts";
import { EnvioIndexerBridge, NullIndexerBridge } from "./indexer.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { registerInfoRoutes } from "./routes/info.ts";
import { registerStarterRoutes } from "./routes/starter.ts";
import { registerStorageRoutes } from "./routes/storage.ts";
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
const ctx: ApiContext = {
  env,
  secrets,
  db,
  log,
  chains,
  sessions: secrets.sessionSecret ? new SessionKeys(secrets.sessionSecret) : undefined,
  indexer,
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
await app.register(cors, { origin: env.CORS_ORIGINS, credentials: false });
await app.register(rateLimit, { global: false });
await app.register(websocket, { options: { maxPayload: WS_MAX_PAYLOAD_BYTES } });

registerInfoRoutes(app, ctx);
registerAuthRoutes(app, ctx);
registerStarterRoutes(app, ctx);
registerStorageRoutes(app, ctx);
registerEngagementRoutes(app, ctx);
const hub = new WsHub(ctx);
hub.register(app);
hub.start();

await listen(app, env.PORT, env.HOST, async () => {
  hub.stop();
  indexer.stop();
  for (const chain of chains.values()) await chain.heads.stop();
  await db.end();
});
