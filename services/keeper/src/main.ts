import {
  createReadClient,
  createSender,
  createWsClient,
  FeeCache,
  HeadTracker,
  LocalNonceSource,
  MemoryJournal,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
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
  pingDb,
} from "@senryo/service-common";
import { type KeeperContext, RecentActions } from "./context.ts";
import { type KeeperJob, loadKeeperEnv } from "./env.ts";
import { liquidationJob } from "./jobs/liquidate.ts";
import { holdExpiryJob, triggerJob } from "./jobs/maintenance.ts";
import { mirrorJob, observeJob } from "./jobs/oracle.ts";
import { pushOutboxJob } from "./jobs/pushes.ts";
import { pushReceiptsJob } from "./jobs/receipts.ts";
import { retentionJob } from "./jobs/retention.ts";
import { sweepJob } from "./jobs/sweeps.ts";
import { alertsJob, walletsJob } from "./jobs/watch.ts";
import { LedgerNotifier } from "./notify.ts";
import { type Job, Runner } from "./runner.ts";
import { IndexerSource, LedgerSource } from "./sources.ts";

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
  journal: new MemoryJournal(),
});
const expo = expoClient(env);
const ledgerSource = new LedgerSource(db, env.CHAIN_ID, env.KEEPER_WATCH_ACCOUNTS ?? []);
const ctx: KeeperContext = {
  env,
  chainId: env.CHAIN_ID,
  read,
  sender,
  db,
  log,
  source: env.INDEXER_GRAPHQL_URL
    ? new IndexerSource(env.INDEXER_GRAPHQL_URL, env.CHAIN_ID, ledgerSource, log)
    : ledgerSource,
  notifier: new LedgerNotifier(db, log, expo ? new PushDelivery(db, log, expo) : undefined),
  mainnet: createReadClient(MAINNET_CHAIN_ID, { http: env.SOURCE_RPC_HTTP }),
  recent: new RecentActions(),
};

const factories: Record<KeeperJob, (c: KeeperContext) => Job> = {
  liquidate: liquidationJob,
  observe: observeJob,
  mirror: mirrorJob,
  triggers: triggerJob,
  holds: holdExpiryJob,
  retention: retentionJob,
  alerts: alertsJob,
  wallets: walletsJob,
  sweeps: sweepJob,
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
