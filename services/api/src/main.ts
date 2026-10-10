import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { isDeployed } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import {
  createDb,
  createHttpServer,
  createLogger,
  DUEL_CHANNEL,
  type DuelNotice,
  EVENT_CHANNEL,
  type EventNotice,
  installProcessGuards,
  listen,
  loadOptionalSigner,
  migrate,
  PARLAY_CHANNEL,
  type ParlayNotice,
  pingDb,
  SessionKeys,
  TICKET_CHANNEL,
  type TicketNotice,
} from "@senryo/service-common";
import { CORS_METHODS } from "./constants.ts";
import { type ApiContext, openChains } from "./context.ts";
import { DuelQueue } from "./duel/queue.ts";
import { DuelRelay } from "./duel/relay.ts";
import { loadApiEnv } from "./env.ts";
import { EventRelay } from "./events/relay.ts";
import { GeoDb } from "./geo-db.ts";
import { DuelReader } from "./history/duel-reader.ts";
import { PythGateway } from "./prices/gateway.ts";
import { AccountRelay } from "./relay/accounts.ts";
import { ExitWatcher } from "./relay/exits.ts";
import { type Lane, openLanes } from "./relay/lanes.ts";
import { ParlayRelay } from "./relay/parlays.ts";
import { MarketRelay } from "./relay/relay.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerDuelRoutes } from "./routes/duels.ts";
import { registerEarnRoutes } from "./routes/earn.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { registerEventRoutes } from "./routes/events.ts";
import { registerGameRoutes } from "./routes/games.ts";
import { registerHistoryRoutes } from "./routes/history.ts";
import { registerInfoRoutes } from "./routes/info.ts";
import { registerMarketRoutes } from "./routes/markets.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";
import { registerParlayRoutes } from "./routes/parlays.ts";
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
const guards = installProcessGuards(log);
const db = createDb(env.DATABASE_URL, "senryo-api");
await migrate(db, log);

const chains = await openChains(env, log);
const geo = new GeoDb(log);
geo.start();
const bus = new StreamBus();
const gateway = new PythGateway(db, bus, log, {
  pythKey: secrets.pythKey,
  hermesOrigin: env.HERMES_ORIGIN,
  redstoneGateways: secrets.redstoneGateways,
});
gateway.start();

// Sponsor lanes (relayer keys, D-266): SPONSOR_PK, plus SPONSOR_2_PK for a second lane.
const sponsors = [loadOptionalSigner("SPONSOR"), loadOptionalSigner("SPONSOR_2")].filter((s) => s !== undefined);
const markets: ApiContext["markets"] = new Map();
for (const chain of chains.values()) {
  if (!chain.deployed || sponsors.length === 0) continue;
  const lanes = openLanes(chain.chainId, chain.read, chain.heads, db, sponsors);
  const relay = new MarketRelay({ chainId: chain.chainId, read: chain.read, lanes, gateway, bus, db, log });
  // Exits fire from the first sponsor lane: `SPONSOR` holds the reserve's EXIT role for trails (D-292).
  const exits = new ExitWatcher({
    chainId: chain.chainId as ChainId,
    read: chain.read,
    lane: lanes[0] as Lane,
    gateway,
    fills: relay.fills,
    db,
    log,
  });
  exits.start();
  const parlays = new ParlayRelay({
    chainId: chain.chainId as ChainId,
    read: chain.read,
    lanes,
    gateway,
    relay,
    db,
    log,
  });
  const accounts = new AccountRelay({
    chainId: chain.chainId as ChainId,
    read: chain.read,
    laneFor: (owner) => relay.laneFor(owner),
    bus,
    db,
    log,
  });
  // Duels (D-294) once the arena is deployed: the matchmaker opens from the first lane (`SPONSOR` holds DUEL).
  let duels: { queue: DuelQueue; relay: DuelRelay } | undefined;
  if (isDeployed(chain.chainId, "DuelArena")) {
    const ratings = new DuelReader(db, env.INDEXER_SCHEMA);
    const duelRelay = new DuelRelay({
      chainId: chain.chainId as ChainId,
      lane: lanes[0] as Lane,
      relay,
      gateway,
      bus,
      db,
      log,
    });
    const queue = new DuelQueue({
      chainId: chain.chainId as ChainId,
      read: chain.read,
      relay: duelRelay,
      gateway,
      bus,
      db,
      log,
      ratings: (owners) => ratings.ratings(chain.chainId as ChainId, owners),
    });
    queue.start();
    duels = { queue, relay: duelRelay };
  }
  // Yes/no events (D-296) once the book is deployed: each call goes out on its caller's lane.
  const events = isDeployed(chain.chainId, "EventBook")
    ? new EventRelay({ chainId: chain.chainId as ChainId, read: chain.read, relay, db, log })
    : undefined;
  markets.set(chain.chainId, { relay, accounts, exits, parlays, duels, events });
  log.info({ chainId: chain.chainId, lanes: sponsors.map((s) => s.address) }, "relay ready");
}
if (sponsors.length === 0) log.warn("no SPONSOR_PK — calls, sessions and Practice dollars answer 503");

// Every ticket change any service applies reaches the owner's stream and the relay's intents (D-272).
await db.listen(TICKET_CHANNEL, (payload) => {
  const notice = JSON.parse(payload) as TicketNotice;
  bus.emit(`user:${notice.owner}`, "ticket", notice);
  markets.get(notice.chainId)?.exits.onTicket(notice);
  void markets
    .get(notice.chainId)
    ?.duels?.relay.onTicket(notice)
    .catch((error) => log.warn({ err: (error as Error).message }, "duel update from a ticket notice failed"));
  void markets
    .get(notice.chainId)
    ?.relay.onTicket(notice)
    .catch((error) => log.warn({ err: (error as Error).message }, "intent update from a ticket notice failed"));
});

// Every parlay change reaches the owner's stream and the parlay's intent the same way.
await db.listen(PARLAY_CHANNEL, (payload) => {
  const notice = JSON.parse(payload) as ParlayNotice;
  bus.emit(`user:${notice.owner}`, "parlay", notice);
  void markets
    .get(notice.chainId)
    ?.parlays.onParlay(notice)
    .catch((error) => log.warn({ err: (error as Error).message }, "intent update from a parlay notice failed"));
});

// Every duel change reaches both players' streams; the apps re-read the match.
await db.listen(DUEL_CHANNEL, (payload) => {
  const notice = JSON.parse(payload) as DuelNotice;
  for (const player of notice.players) bus.emit(`user:${player}`, "duel", notice);
});

// Every event change moves the board's pools for everyone; a call or a payout also reaches its caller's stream.
await db.listen(EVENT_CHANNEL, (payload) => {
  const notice = JSON.parse(payload) as EventNotice;
  bus.emit("markets", "event", notice);
  if (notice.owner) bus.emit(`user:${notice.owner}`, "eventCall", notice);
});

const ctx: ApiContext = {
  env,
  secrets,
  db,
  log,
  guards,
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
registerParlayRoutes(app, ctx);
registerDuelRoutes(app, ctx);
registerEventRoutes(app, ctx);
registerGameRoutes(app, ctx);
registerHistoryRoutes(app, ctx);
registerPriceRoutes(app, gateway);
registerStreamRoute(app, {
  bus,
  ticketSecret: secrets.sessionSecret,
  corsOrigins: env.CORS_ORIGINS,
  snapshot: (topic, batched) => (topic === "prices" ? gateway.snapshot(batched) : []),
  beatData: () => ({ h: gateway.healthDigest() }),
});

await listen(app, env.PORT, env.HOST, async () => {
  geo.stop();
  for (const m of markets.values()) {
    m.exits.stop();
    m.duels?.queue.stop();
  }
  await gateway.stop();
  for (const chain of chains.values()) await chain.heads.stop();
  await db.end();
});
