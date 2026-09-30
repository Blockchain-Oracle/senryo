import rateLimit from "@fastify/rate-limit";
import {
  createReadClient,
  createSender,
  createWsClient,
  FeeCache,
  HeadTracker,
  LocalNonceSource,
  MemoryJournal,
} from "@senryo/chain";
import {
  createDb,
  createHttpServer,
  createLogger,
  listen,
  loadSignerSet,
  migrate,
  pingDb,
  SessionKeys,
} from "@senryo/service-common";
import { bytes32Of } from "./amounts.ts";
import { MAX_OPERATORS } from "./constants.ts";
import type { CardContext } from "./context.ts";
import { loadCardEnv } from "./env.ts";
import { LithicApi } from "./lithic/api.ts";
import { startOutbox } from "./outbox.ts";
import { registerAppRoutes } from "./routes/app.ts";
import { registerLithicRoutes } from "./routes/lithic.ts";

const { env, secrets } = loadCardEnv();
const log = createLogger("card", env.LOG_LEVEL);
const db = createDb(env.DATABASE_URL, "senryo-card");
await migrate(db, log);

const rpc = { http: env.RPC_HTTP, ws: env.RPC_WS };
const read = createReadClient(env.CHAIN_ID, rpc);
const heads = new HeadTracker(read, createWsClient(env.CHAIN_ID, rpc));
await heads.start();
// Cached base fee refreshed every second (hot path: no fee round trip).
const fees = new FeeCache(read);
fees.start();
const nonces = new LocalNonceSource(read);
const operators = loadSignerSet("OPERATOR", MAX_OPERATORS).map((account) =>
  createSender({ chainId: env.CHAIN_ID, account, rpc, read, heads, fees, nonces, journal: new MemoryJournal() }),
);
if (operators.length === 0) throw new Error("no card operator keys (OPERATOR_1_PK / OPERATOR_1_PK_FILE …)");

const ctx: CardContext = {
  env,
  secrets,
  chainId: env.CHAIN_ID,
  read,
  db,
  log,
  operators,
  issuer: bytes32Of(env.CARD_ISSUER_LABEL),
  lithic: secrets.apiKey ? new LithicApi(secrets.apiKey, env.LITHIC_API_BASE) : undefined,
  sessions: secrets.sessionSecret ? new SessionKeys(secrets.sessionSecret) : undefined,
};
if (!secrets.asaSecret) log.warn("LITHIC_ASA_SECRET unset — every ASA request is rejected (401)");

const stopOutbox = startOutbox(ctx);
const app = createHttpServer({
  service: "card",
  logger: log,
  ready: async () => ({
    db: await pingDb(db),
    heads: heads.current().finalized > 0n,
    asaSecret: Boolean(secrets.asaSecret),
  }),
});
await app.register(rateLimit, { global: false });
registerLithicRoutes(app, ctx);
registerAppRoutes(app, ctx);
log.info(
  { chainId: env.CHAIN_ID, operators: operators.map((o) => o.account.address), issuer: env.CARD_ISSUER_LABEL },
  "card service started",
);

await listen(app, env.PORT, env.HOST, async () => {
  stopOutbox();
  fees.stop();
  await heads.stop();
  await db.end();
});
