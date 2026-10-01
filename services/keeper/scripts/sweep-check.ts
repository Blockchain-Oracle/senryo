/**
 * S8.24 cold-start check (local only): an anvil fork of 10143 + a scratch Postgres, driving the real `sweeps` job.
 * A user with NO key and NO MON receives stablecoins at their counterfactual inbox and ends up credited in the core:
 *  1. below INBOX_SWEEP_MIN_USD6 nothing is sent (gas is only spent after real value lands);
 *  2. at the minimum the watched, undeployed inbox is deployed + swept into `depositFor(user)`, recorded, pushed;
 *  3. an expired watch is ignored; the indexer path (a deployed inbox with `pending`) sweeps AUSD and USDC together;
 *  4. a second fresh user funded with both stablecoins measures the worst case (deploy + two deposits) for the cap.
 * Run: anvil --fork-url https://testnet-rpc.monad.xyz --port 18765 --block-time 0.5 --mixed-mining --slots-in-an-epoch 1
 *      createdb senryo_sweep_check
 *      FORK_RPC=http://127.0.0.1:18765 DATABASE_URL=postgres://127.0.0.1:5432/senryo_sweep_check KEEPER_PK_FILE=… \
 *        pnpm --filter @senryo/keeper sweep-check
 */
import { randomBytes } from "node:crypto";
import {
  type Address,
  contractCall,
  createReadClient,
  createSender,
  getAddress,
  type Hex,
  MemoryJournal,
  readAccountSnapshot,
  readContract,
  sendAndFinalize,
  signerFromPrivateKey,
} from "@senryo/chain";
import { GAS_HEADROOM_BPS, GAS_LIMITS, INBOX_SWEEP_MIN_USD6 } from "@senryo/config";
import { createDb, createLogger, loadSigner, migrate, requireSecret, watchInbox } from "@senryo/service-common";
import { type KeeperContext, RecentActions } from "../src/context.ts";
import { keeperEnvSchema } from "../src/env.ts";
import { sweepJob } from "../src/jobs/sweeps.ts";
import { LedgerNotifier } from "../src/notify.ts";
import type { InboxCandidate, KeeperSource } from "../src/sources.ts";

const CHAIN = 10143;
const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const RICH = "0x8ac7230489e80000";
const KEY_BYTES = 32;
const ADDRESS_BYTES = 20;
const DUST = INBOX_SWEEP_MIN_USD6 / 2n;
const FIRST_DEPOSIT_USD6 = 25_000_000n;
const LATER_DEPOSIT_USD6 = 10_000_000n;
const BPS = 10_000n;

const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function anvil(method: string, params: unknown[]): Promise<void> {
  const res = await fetch(FORK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
}

const log = createLogger("sweep-check", "warn");
const read = createReadClient(CHAIN, { http: [FORK] });
const db = createDb(requireSecret("DATABASE_URL"), "senryo-sweep-check", 2);
await migrate(db, log);

const keeperKey = loadSigner("KEEPER");
await anvil("anvil_setBalance", [keeperKey.address, RICH]);
const keeper = createSender({
  chainId: CHAIN,
  account: keeperKey,
  read,
  rpc: { http: [FORK] },
  journal: new MemoryJournal(),
});

// A funded stranger plays "an exchange / another wallet": faucet once, then plain ERC-20 transfers to the inboxes.
const depositorKey = signerFromPrivateKey(`0x${randomBytes(KEY_BYTES).toString("hex")}` as Hex, "depositor");
await anvil("anvil_setBalance", [depositorKey.address, RICH]);
const depositor = createSender({
  chainId: CHAIN,
  account: depositorKey,
  read,
  rpc: { http: [FORK] },
  journal: new MemoryJournal(),
});
await sendAndFinalize(depositor, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
await sendAndFinalize(depositor, contractCall(CHAIN, "MockUSDC", "faucet", [], "faucet"));
/** A plain ERC-20 transfer, budgeted like an approve (one balance slot pair). */
const send = (token: "MockAUSD" | "MockUSDC", to: Address, amount: bigint) =>
  sendAndFinalize(depositor, contractCall(CHAIN, token, "transfer", [to, amount], "approve"));

const factory = readContract(CHAIN, "InboxFactory", read);
const freshUser = () => getAddress(`0x${randomBytes(ADDRESS_BYTES).toString("hex")}`);
const collateral = async (user: Address) => {
  const s = await readAccountSnapshot(read, CHAIN, user, "latest");
  return s.ausd + s.usdc;
};
const deployed = async (inbox: Address) => ((await read.getCode({ address: inbox })) ?? "0x") !== "0x";

// The keeper's context with an in-memory indexer source the check controls.
let indexed: InboxCandidate[] = [];
const source: KeeperSource = {
  accounts: async () => [],
  triggerOrders: async () => [],
  pendingInboxes: async () => indexed,
};
const recent = new RecentActions();
const ctx: KeeperContext = {
  env: keeperEnvSchema.parse({ DATABASE_URL: requireSecret("DATABASE_URL"), CHAIN_ID: String(CHAIN), RPC_HTTP: FORK }),
  chainId: CHAIN,
  read,
  sender: keeper,
  db,
  log,
  source,
  notifier: new LedgerNotifier(db, log),
  mainnet: read,
  recent,
};
const job = sweepJob(ctx);
const gasOf = async (hash: string) => (await read.getTransactionReceipt({ hash: hash as Hex })).gasUsed;

// 1 — a brand-new user (no key, no MON) and their counterfactual inbox, registered as the api would.
const alice = freshUser();
const aliceInbox = await factory.read.inboxOf([alice]);
await watchInbox(db, CHAIN, alice, aliceInbox);
record("inbox starts undeployed", !(await deployed(aliceInbox)), aliceInbox);
await send("MockAUSD", aliceInbox, DUST);
await job.run();
record(
  "below the minimum nothing is sent",
  recent.list().length === 0 && !(await deployed(aliceInbox)),
  `${DUST} usd6`,
);

// 2 — reach the minimum: deploy + sweep, credited in the core, watch + push recorded.
const firstDeposit = FIRST_DEPOSIT_USD6;
await send("MockAUSD", aliceInbox, firstDeposit - DUST);
await job.run();
const first = recent.list()[0];
const firstGas = first ? await gasOf(first.tx) : 0n;
record("watched inbox swept at the minimum", first?.stage === "finalized" && (await deployed(aliceInbox)), first?.tx);
record(
  "the user is credited in the core",
  (await collateral(alice)) === firstDeposit,
  `${await collateral(alice)} usd6`,
);
const [watch] = await db<{ sweep_count: number }[]>`
  SELECT sweep_count FROM inbox_watches WHERE chain_id = ${CHAIN} AND user_address = ${alice.toLowerCase()}`;
const [push] = await db`SELECT 1 FROM push_sends WHERE event_key = ${`sweep:${CHAIN}:${first?.tx}`}`;
record("watch row and deposit push recorded", watch?.sweep_count === 1 && push !== undefined);

// 3 — an expired watch is ignored; the indexer path sweeps both stablecoins from the now-deployed inbox.
await db`UPDATE inbox_watches SET expires_at = now() - interval '1 second' WHERE user_address = ${alice.toLowerCase()}`;
const second = LATER_DEPOSIT_USD6;
await send("MockAUSD", aliceInbox, second);
await send("MockUSDC", aliceInbox, second);
await job.run();
record("an expired watch is not scanned", recent.list().length === 1);
indexed = [{ user: alice, inbox: aliceInbox }];
await job.run();
const both = recent.list()[0];
const bothGas = both && both !== first ? await gasOf(both.tx) : 0n;
record(
  "indexer path sweeps AUSD + USDC together",
  both !== first && (await collateral(alice)) === firstDeposit + 2n * second,
  `${await collateral(alice)} usd6`,
);
indexed = [];

// 4 — worst case at zero positions: a fresh inbox holding both stablecoins (deploy + two depositFor).
const bob = freshUser();
const bobInbox = await factory.read.inboxOf([bob]);
await watchInbox(db, CHAIN, bob, bobInbox);
await send("MockAUSD", bobInbox, second);
await send("MockUSDC", bobInbox, second);
await job.run();
const worst = recent.list()[0];
const worstGas = worst && worst !== both ? await gasOf(worst.tx) : 0n;
record("fresh inbox with both stablecoins swept", (await collateral(bob)) === 2n * second, worst?.tx);
console.log(
  `gas used (testnet) — deploy + AUSD: ${firstGas} · deployed, AUSD + USDC: ${bothGas} · deploy + both: ${worstGas}` +
    ` · cap sweepInbox ${GAS_LIMITS.sweepInbox}`,
);
record(
  "cap covers the worst case with headroom",
  worstGas > 0n && worstGas * (BPS + GAS_HEADROOM_BPS) <= GAS_LIMITS.sweepInbox * BPS,
);

await db`DELETE FROM inbox_watches WHERE user_address IN (${alice.toLowerCase()}, ${bob.toLowerCase()})`;
await db`DELETE FROM push_sends WHERE user_address IN (${alice.toLowerCase()}, ${bob.toLowerCase()})`;
await db.end();
const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
