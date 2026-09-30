/**
 * S3.8 card concurrency check (local Postgres + anvil fork of Monad testnet; D-018 "card-concurrency check").
 * N parallel ASA authorisations for ONE account (each also retried concurrently, like Lithic on a dropped
 * connection) must never reserve more than freeToSpend, and holds must stay inside the user's spend allowance (D-032).
 *   anvil --fork-url <testnet rpc> --network monad --port 18645 --block-time 0.5 --mixed-mining --slots-in-an-epoch 1
 *   services/card running against the fork (see the S3 handoff) · then:
 *   FORK_RPC=http://127.0.0.1:18645 CARD_URL=http://127.0.0.1:3101 LITHIC_ASA_SECRET=whsec_… DATABASE_URL=… \
 *   OPERATOR_1_PK_FILE=… OPERATOR_2_PK_FILE=… pnpm --filter @senryo/drive card-concurrency
 */
import {
  addressOf,
  contractCall,
  coreDomain,
  createSender,
  readAccountSnapshot,
  readHolds,
  sendAndFinalize,
  signerFromPrivateKey,
} from "@senryo/chain";
import { SPEND_ALLOWANCE_TYPES } from "@senryo/core";
import { createDb, requireSecret } from "@senryo/service-common";
import { buildAsa, buildEvent, sendAsa, sendEvent } from "./asa-client.ts";
import { MS_PER_SECOND, WAIT } from "./constants.ts";
import { freshUser, prepareFork } from "./fork.ts";
import { CHAIN, waitUntil } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18645";
const CARD = process.env.CARD_URL ?? "http://127.0.0.1:3101";
const secret = requireSecret("LITHIC_ASA_SECRET");
const webhookSecret = requireSecret("LITHIC_WEBHOOK_SECRET");
const db = createDb(requireSecret("DATABASE_URL"), "senryo-drive", 2);
const rpc = { http: [FORK], ws: [] };
const operators = ["OPERATOR_1", "OPERATOR_2"].map((n) => signerFromPrivateKey(requireSecret(`${n}_PK`), n).address);
const USD6 = 1_000_000n;
const CENTS_PER_USD = 100;
const DAY_SEC = 86_400n;
const THREE_USD_CENTS = 300;
const TWO_USD_CENTS = 200;

interface Scenario {
  name: string;
  depositUsd: bigint;
  allowanceUsd: bigint;
  auths: number;
  centsEach: number;
}

const SCENARIOS: Scenario[] = [
  { name: "allowance-bound", depositUsd: 50n, allowanceUsd: 20n, auths: 12, centsEach: THREE_USD_CENTS },
  { name: "funds-bound", depositUsd: 10n, allowanceUsd: 1_000n, auths: 8, centsEach: TWO_USD_CENTS },
];

async function setupUser(s: Scenario) {
  const user = freshUser();
  await prepareFork(FORK, [], [user.address]);
  const sender = createSender({ chainId: CHAIN, account: user, rpc });
  const ausd = addressOf(CHAIN, "MockAUSD");
  const core = addressOf(CHAIN, "SenryoCore");
  const deposit = s.depositUsd * USD6;
  await sendAndFinalize(sender, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
  await sendAndFinalize(sender, contractCall(CHAIN, "MockAUSD", "approve", [core, deposit], "approve"));
  await sendAndFinalize(sender, contractCall(CHAIN, "SenryoCore", "deposit", [ausd, deposit], "deposit"));
  const expiry = BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + DAY_SEC;
  const dailyLimit = s.allowanceUsd * USD6;
  const signature = await user.signTypedData({
    domain: coreDomain(CHAIN),
    types: SPEND_ALLOWANCE_TYPES,
    primaryType: "SpendAllowance",
    message: { user: user.address, dailyLimit, expiry, nonce: 0n },
  });
  await sendAndFinalize(
    sender,
    contractCall(
      CHAIN,
      "SenryoCore",
      "setSpendAllowance",
      [user.address, dailyLimit, expiry, signature],
      "setSpendAllowance",
    ),
  );
  return { user: user.address, read: sender.read };
}

async function runScenario(s: Scenario) {
  const { user, read } = await setupUser(s);
  const before = await readAccountSnapshot(read, CHAIN, user, "finalized");
  const cardToken = `drive-${s.name}-${Date.now()}`;
  await db`INSERT INTO cards (card_token, issuer, chain_id, account) VALUES (${cardToken}, 'lithic-sandbox', ${CHAIN}, ${user.toLowerCase()})`;
  const calls = Array.from({ length: s.auths }, () => buildAsa(secret, cardToken, s.centsEach));
  // Every authorisation is sent twice at once (a Lithic retry): same bytes, same token.
  const replies = await Promise.all([...calls, ...calls].map((call) => sendAsa(CARD, call)));
  const byToken = new Map<string, string[]>();
  for (const r of replies) byToken.set(r.token, [...(byToken.get(r.token) ?? []), r.result ?? `HTTP ${r.status}`]);
  const settled = await waitUntil(
    async () => {
      const [row] = await db<{ open: bigint }[]>`SELECT count(*)::bigint AS open FROM holds
        WHERE account = ${user.toLowerCase()} AND status IN ('RESERVED', 'SUBMITTED', 'ONCHAIN')`;
      return row && row.open === 0n ? true : undefined;
    },
    WAIT.liquidationMs,
    WAIT.pollMs,
  );
  const after = await readAccountSnapshot(read, CHAIN, user, "finalized");
  const holds = await db<
    { status: string; amount_usd6: bigint }[]
  >`SELECT status, amount_usd6 FROM holds WHERE account = ${user.toLowerCase()}`;
  const approved = [...byToken.values()].filter((results) => results[0] === "APPROVED").length;
  const approvedUsd6 = BigInt(approved * s.centsEach) * (USD6 / BigInt(CENTS_PER_USD));
  const consistent = [...byToken.values()].every((results) => results.every((r) => r === results[0]));
  const failed = holds.filter((h) => h.status === "FAILED").length;
  const unbalanced = await db`SELECT * FROM ledger_unbalanced`;
  const approvedTokens = [...byToken.entries()].filter(([, r]) => r[0] === "APPROVED").map(([token]) => token);
  return {
    context: { user, read, cardToken, approvedTokens, holdUsd6: approvedUsd6 / BigInt(Math.max(approved, 1)) },
    scenario: s.name,
    user,
    freeToSpendBefore: before.freeToSpend.toString(),
    allowanceLeftBefore: before.allowanceLeft.toString(),
    requested: `${s.auths} × ${s.centsEach} cents (each sent twice concurrently)`,
    approved,
    approvedUsd6: approvedUsd6.toString(),
    onchainHoldsUsd6: after.holds.toString(),
    declines: [...byToken.values()].filter((r) => r[0] !== "APPROVED").map((r) => r[0]),
    checks: {
      neverAboveFreeToSpend: approvedUsd6 <= before.freeToSpend,
      withinAllowance: approvedUsd6 <= before.allowanceLeft,
      onchainMatchesApproved: after.holds === approvedUsd6,
      duplicatesConsistent: consistent,
      noRevertedHolds: failed === 0,
      settled: settled === true,
      ledgerBalanced: unbalanced.length === 0,
    },
    latencyMs: replies.map((r) => r.ms).sort((a, b) => a - b),
  };
}

/**
 * Lifecycle through the events webhook → outbox → chain: CLEARING (delivered twice) captures one approved hold, a full
 * AUTHORIZATION_REVERSAL releases another; both re-checked onchain and booked in the double-entry ledger.
 */
async function runLifecycle(ctx: Awaited<ReturnType<typeof runScenario>>["context"]) {
  const [captureToken, releaseToken] = ctx.approvedTokens;
  if (!captureToken || !releaseToken) return { lifecycle: "skipped (need two approved holds)", checks: { ran: false } };
  const cents = Number(ctx.holdUsd6 / (USD6 / BigInt(CENTS_PER_USD)));
  const clearing = buildEvent(webhookSecret, captureToken, ctx.cardToken, "CLEARING", cents);
  const replies = await Promise.all([
    sendEvent(CARD, clearing),
    sendEvent(CARD, clearing),
    sendEvent(CARD, buildEvent(webhookSecret, releaseToken, ctx.cardToken, "AUTHORIZATION_REVERSAL", cents)),
  ]);
  const before = await readAccountSnapshot(ctx.read, CHAIN, ctx.user, "finalized");
  const done = await waitUntil(
    async () => {
      const [row] = await db<
        { open: bigint }[]
      >`SELECT count(*)::bigint AS open FROM outbox WHERE status IN ('PENDING', 'SENDING')`;
      return row && row.open === 0n ? true : undefined;
    },
    WAIT.liquidationMs,
    WAIT.pollMs,
  );
  const rows = await db<{ hold_id: string; txn_token: string; status: string }[]>`
    SELECT hold_id, txn_token, status FROM holds WHERE txn_token IN (${captureToken}, ${releaseToken})`;
  const onchain = await readHolds(
    ctx.read,
    CHAIN,
    rows.map((r) => r.hold_id as `0x${string}`),
  );
  const after = await readAccountSnapshot(ctx.read, CHAIN, ctx.user, "finalized");
  const outbox = await db<
    { kind: string; status: string; tx_hash: string | null }[]
  >`SELECT kind, status, tx_hash FROM outbox ORDER BY id`;
  const stateOf = (token: string) => {
    const id = rows.find((r) => r.txn_token === token)?.hold_id;
    return onchain.find((h) => h.holdId === id)?.state;
  };
  return {
    lifecycle: {
      webhookReplies: replies,
      outbox,
      holdsBefore: before.holds.toString(),
      holdsAfter: after.holds.toString(),
    },
    checks: {
      outboxDrained: done === true,
      captured: stateOf(captureToken) === "CAPTURED",
      released: stateOf(releaseToken) === "RELEASED",
      duplicateEventIgnored: replies.filter((r) => r.queued === 1).length === 2,
      holdsReduced: after.holds === before.holds - 2n * ctx.holdUsd6,
      ledgerBalanced: (await db`SELECT * FROM ledger_unbalanced`).length === 0,
    },
  };
}

await prepareFork(FORK, operators, []);
const results = [];
for (const s of SCENARIOS) results.push(await runScenario(s));
const first = results[0];
const lifecycle = first ? await runLifecycle(first.context) : undefined;
const pass =
  results.every((r) => Object.values(r.checks).every(Boolean)) && Object.values(lifecycle?.checks ?? {}).every(Boolean);
const printable = results.map(({ context: _context, ...rest }) => rest);
console.log(JSON.stringify({ pass, results: printable, lifecycle }, null, 2));
await db.end();
process.exit(pass ? 0 : 1);
