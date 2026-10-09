import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { ChainId } from "@senryo/config";
import {
  createDb,
  createHttpServer,
  createLogger,
  listen,
  loadOptionalSigner,
  migrate,
  pingDb,
  SessionKeys,
  TICKET_CHANNEL,
  type TicketNotice,
} from "@senryo/service-common";
import { CORS_METHODS } from "./constants.ts";
import { type ApiContext, openChains } from "./context.ts";
import { loadApiEnv } from "./env.ts";
import { GeoDb } from "./geo-db.ts";
import { ARCHIVE_PENDING_MS } from "./prices/constants.ts";
import { PythGateway } from "./prices/gateway.ts";
import { AccountRelay } from "./relay/accounts.ts";
import { openLanes } from "./relay/lanes.ts";
import { MarketRelay } from "./relay/relay.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerEarnRoutes } from "./routes/earn.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { registerHistoryRoutes } from "./routes/history.ts";
import { registerInfoRoutes } from "./routes/info.ts";
import { registerMarketRoutes } from "./routes/markets.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";
import { registerPriceRoutes } from "./routes/prices.ts";
import { registerProfileRoutes } from "./routes/profile.ts";
import { registerStorageRoutes } from "./routes/storage.ts";
import { StreamBus } from "./stream/bus.ts";
import { registerStreamRoute } from "./stream/route.ts";

/**
 * The api: sign-in, encrypted storage, push tokens and the inbox, handles and profiles, config/geo/status — and the
 * markets (S3, D-272): the one Pyth gateway, the one multiplexed `/v1/stream`, the relay for signed calls and
 * sessions, and Practice dollars. S4 adds the indexer's history; S9 Aurora deposits.
 */
const { env, secrets } = loadApiEnv();
const log = createLogger("api", env.LOG_LEVEL);
const db = createDb(env.DATABASE_URL, "senryo-api");
await migrate(db, log);

const chains = await openChains(env, log);
const geo = new GeoDb(log);
geo.start();
const bus = new StreamBus();
const gateway = new PythGateway(db, bus, log, secrets.pythKey);
gateway.start();
const archiveTimer = setInterval(() => {
  void gateway
    .archivePending(db)
    .catch((error) => log.warn({ err: (error as Error).message }, "archive pending failed"));
}, ARCHIVE_PENDING_MS);

// Sponsor lanes (relayer keys, D-266): SPONSOR_PK, plus SPONSOR_2_PK for a second lane.
const sponsors = [loadOptionalSigner("SPONSOR"), loadOptionalSigner("SPONSOR_2")].filter((s) => s !== undefined);
const markets: ApiContext["markets"] = new Map();
for (const chain of chains.values()) {
  if (!chain.deployed || sponsors.length === 0) continue;
  const lanes = openLanes(chain.chainId, chain.read, chain.heads, db, sponsors);
  const relay = new MarketRelay({ chainId: chain.chainId, read: chain.read, lanes, gateway, bus, db, log });
  const accounts = new AccountRelay({
    chainId: chain.chainId as ChainId,
    read: chain.read,
    laneFor: (owner) => relay.laneFor(owner),
    bus,
    db,
    log,
  });
  markets.set(chain.chainId, { relay, accounts });
  log.info({ chainId: chain.chainId, lanes: sponsors.map((s) => s.address) }, "relay ready");
}
if (sponsors.length === 0) log.warn("no SPONSOR_PK — calls, sessions and Practice dollars answer 503");

// Every ticket change any service applies reaches the owner's stream and the relay's intents (D-272).
await db.listen(TICKET_CHANNEL, (payload) => {
  const notice = JSON.parse(payload) as TicketNotice;
  bus.emit(`user:${notice.owner}`, "ticket", notice);
  void markets
    .get(notice.chainId)
    ?.relay.onTicket(notice)
    .catch((error) => log.warn({ err: (error as Error).message }, "intent update from a ticket notice failed"));
});

const ctx: ApiContext = {
  env,
  secrets,
  db,
  log,
  chains,
  sessions: secrets.sessionSecret ? new SessionKeys(secrets.sessionSecret) : undefined,
  geo,
  gateway,
  bus,
  markets,
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
registerMarketRoutes(app, ctx);
registerEarnRoutes(app, ctx);
registerHistoryRoutes(app, ctx);
registerPriceRoutes(app, gateway);
registerStreamRoute(app, {
  bus,
  ticketSecret: secrets.sessionSecret,
  corsOrigins: env.CORS_ORIGINS,
  snapshot: (topic) => (topic === "prices" ? gateway.snapshot() : []),
});

await listen(app, env.PORT, env.HOST, async () => {
  geo.stop();
  clearInterval(archiveTimer);
  gateway.stop();
  for (const chain of chains.values()) await chain.heads.stop();
  await db.end();
});
