import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { createDb, createHttpServer, createLogger, listen, migrate, pingDb, SessionKeys } from "@senryo/service-common";
import { createAnyAsset } from "./anyasset/runtime.ts";
import { CORS_METHODS, WS_MAX_PAYLOAD_BYTES } from "./constants.ts";
import { type ApiContext, openChains, oracleMarks } from "./context.ts";
import { loadApiEnv } from "./env.ts";
import { GeoDb } from "./geo-db.ts";
import { EnvioIndexerBridge, NullIndexerBridge } from "./indexer.ts";
import { registerAnyAssetRoutes } from "./routes/anyasset.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { registerFollowRoutes } from "./routes/follow.ts";
import { registerHolderRoutes } from "./routes/holders.ts";
import { registerInboxRoutes } from "./routes/inbox.ts";
import { registerInfoRoutes } from "./routes/info.ts";
import { registerLeaderboardRoutes } from "./routes/leaderboard.ts";
import { registerModerationRoutes } from "./routes/moderation.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";
import { registerPostRoutes } from "./routes/posts.ts";
import { registerProfileRoutes } from "./routes/profile.ts";
import { registerStarterRoutes } from "./routes/starter.ts";
import { registerStorageRoutes } from "./routes/storage.ts";
import { registerTopUpRoutes } from "./routes/topup.ts";
import { FeedPoller } from "./social/feed-poller.ts";
import { HoldersService } from "./social/holders.ts";
import { EnvioSocialIndexer, type SocialIndexer, UnavailableSocialIndexer } from "./social/indexer-source.ts";
import { LeaderboardService } from "./social/leaderboard.ts";
import { FeedNotifier, type SocialServices } from "./social/runtime.ts";
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
// S12b social: indexer reads for the feed poller, leaderboard snapshots and position checks.
const socialIndexer: SocialIndexer = env.INDEXER_GRAPHQL_URL
  ? new EnvioSocialIndexer(env.INDEXER_GRAPHQL_URL, log)
  : new UnavailableSocialIndexer();
const notifier = new FeedNotifier();
const leaderboard = new LeaderboardService({ db, indexer: socialIndexer, log, chainIds: env.CHAIN_IDS });
const feedPoller = new FeedPoller({ db, indexer: socialIndexer, notifier, log, chainIds: env.CHAIN_IDS });
const social: SocialServices = {
  indexer: socialIndexer,
  leaderboard,
  holders: new HoldersService({ db, indexer: socialIndexer, marks: oracleMarks(chains) }),
  notifier,
  chainIds: env.CHAIN_IDS,
  adminSecret: secrets.adminSecret,
  contact: { email: env.SUPPORT_EMAIL, url: env.SUPPORT_URL ?? null },
};
const anyAsset = createAnyAsset(log, chains, secrets);
const ctx: ApiContext = {
  env,
  secrets,
  db,
  log,
  chains,
  sessions: secrets.sessionSecret ? new SessionKeys(secrets.sessionSecret) : undefined,
  indexer,
  geo,
  social,
  aurora: anyAsset.aurora,
};
if (!ctx.sessions) log.warn("API_SESSION_SECRET unset — session routes answer 503");
if (!secrets.adminSecret) log.warn("API_ADMIN_SECRET unset — the moderation review queue answers 503");

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
registerNotificationRoutes(app, ctx);
registerProfileRoutes(app, ctx);
registerFollowRoutes(app, ctx);
registerPostRoutes(app, ctx);
registerLeaderboardRoutes(app, ctx);
registerHolderRoutes(app, ctx);
registerModerationRoutes(app, ctx);
registerAnyAssetRoutes(app, log, anyAsset);
// Rows left non-terminal by a previous process (restart mid-claim) get their real stage; never re-sent (S8.16e).
void reconcilePendingRelays(ctx).catch((err) => log.warn({ err: String(err) }, "relay reconcile failed"));
const hub = new WsHub(ctx);
hub.register(app);
hub.start();
if (env.INDEXER_GRAPHQL_URL) {
  leaderboard.start();
  feedPoller.start();
}

await listen(app, env.PORT, env.HOST, async () => {
  hub.stop();
  feedPoller.stop();
  leaderboard.stop();
  indexer.stop();
  geo.stop();
  for (const chain of chains.values()) await chain.heads.stop();
  await db.end();
});
