import { createReadClient, createSender, createWsClient, FeeCache, HeadTracker, LocalNonceSource } from "@senryo/chain";
import {
  createDb,
  createHttpServer,
  createLogger,
  expoClient,
  listen,
  loadSigner,
  MS_PER_SECOND,
  migrate,
  PushDelivery,
  pgJournal,
  pingDb,
} from "@senryo/service-common";
import { type KeeperContext, RecentActions } from "./context.ts";
import { type KeeperJob, loadKeeperEnv } from "./env.ts";
import { calendarsJob } from "./jobs/calendars.ts";
import { fillsJob } from "./jobs/fills.ts";
import { pushOutboxJob } from "./jobs/pushes.ts";
import { pushReceiptsJob } from "./jobs/receipts.ts";
import { retentionJob } from "./jobs/retention.ts";
import { settleJob } from "./jobs/settle.ts";
import { syncJob } from "./jobs/sync.ts";
import { LedgerNotifier } from "./notify.ts";
import { notifyResults } from "./results.ts";
import { type Job, Runner } from "./runner.ts";

const env = loadKeeperEnv();
const log = createLogger("keeper", env.LOG_LEVEL);
const db = createDb(env.DATABASE_URL, "senryo-keeper");
await migrate(db, log);

const rpc = { http: env.RPC_HTTP, ws: env.RPC_WS };
const read = createReadClient(env.CHAIN_ID, rpc);
const heads = new HeadTracker(read, createWsClient(env.CHAIN_ID, rpc));
await heads.start();
const account = loadSigner("KEEPER");
const fees = new FeeCache(read);
fees.start();
const sender = createSender({
  chainId: env.CHAIN_ID,
  account,
  rpc,
  read,
  heads,
  fees,
  nonces: new LocalNonceSource(read),
  journal: pgJournal(db, `keeper:${env.CHAIN_ID}:${account.address.toLowerCase()}`),
});
const expo = expoClient(env);
const notifier = new LedgerNotifier(db, log, expo ? new PushDelivery(db, log, expo) : undefined);
const ctx: KeeperContext = {
  env,
  chainId: env.CHAIN_ID,
  read,
  sender,
  db,
  log,
  notifier,
  recent: new RecentActions(),
  notifyResults: (changes) => notifyResults(db, notifier, env.CHAIN_ID, changes),
};

const factories: Record<KeeperJob, (c: KeeperContext) => Job> = {
  sync: syncJob,
  settle: settleJob,
  fills: fillsJob,
  calendars: calendarsJob,
  retention: retentionJob,
  receipts: pushReceiptsJob,
  pushes: pushOutboxJob,
};
const runner = new Runner(log);
runner.start(env.KEEPER_JOBS.map((name) => factories[name](ctx)));
log.info(
  { keeper: account.address, chainId: env.CHAIN_ID, jobs: env.KEEPER_JOBS, pushDelivery: env.PUSH_DELIVERY },
  "keeper started",
);

const app = createHttpServer({
  service: "keeper",
  logger: log,
  live: () => {
    const ageSec = Math.floor((Date.now() - runner.lastHeartbeat()) / MS_PER_SECOND);
    return { ok: ageSec <= env.KEEPER_STALE_SEC, detail: { lastTickAgeSec: ageSec } };
  },
  ready: async () => ({ db: await pingDb(db), heads: heads.current().finalized > 0n }),
});
app.get("/v1/keeper/status", async () => ({
  keeper: account.address,
  heads: Object.fromEntries(Object.entries(heads.current()).map(([k, v]) => [k, v.toString()])),
  jobs: runner.snapshot(),
  recent: ctx.recent.list(),
}));

await listen(app, env.PORT, env.HOST, async () => {
  runner.stop();
  fees.stop();
  await heads.stop();
  await db.end();
});
