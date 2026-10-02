/**
 * Card outbox check (UI review fixes; local Postgres + anvil fork of Monad testnet, like card-concurrency). Holds are
 * placed directly by a third operator key, so the check exercises only the outbox — not the ASA deadline.
 *   anvil --fork-url <testnet rpc> --network monad --port 18645 --block-time 0.5 --mixed-mining --slots-in-an-epoch 1
 *   services/card running against the fork with OPERATOR_1_PK / OPERATOR_2_PK, then:
 *   FORK_RPC=… CARD_URL=… LITHIC_WEBHOOK_SECRET=whsec_… DATABASE_URL=<local> OPERATOR_1_PK=… OPERATOR_2_PK=… \
 *     PLACER_PK=… pnpm --filter @senryo/drive card-outbox-check
 * Scenarios:
 *  1. capture-retry   the hold row's CAPTURED write fails once after the capture finalized → the retry settles it
 *                     from the recorded tx: one capture sent, hold CAPTURED with the full (over-)capture, ledger once
 *  2. refund-retry    the refund's ledger write fails once after it finalized → settled on retry, never sent twice;
 *                     the contract itself refuses the same refId again (RefundUsed)
 *  3. capture-debt    an over-capture the collateral can't cover: push, ledger and summary state captured + debt
 *  4. stuck-scope     the 5-minute SENDING reset touches only this network's rows
 * Faults are one-shot Postgres triggers (sequences survive the rollback they cause); everything is removed at the end.
 */
import { randomUUID } from "node:crypto";
import {
  addressOf,
  contractCall,
  coreDomain,
  createSender,
  decodeRevert,
  encodeAbiParameters,
  type Hex,
  keccak256,
  readAccountSnapshot,
  readContract,
  readHolds,
  sendAndFinalize,
  signerFromPrivateKey,
  stringToBytes,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { SPEND_ALLOWANCE_TYPES } from "@senryo/core";
import { createDb, requireSecret } from "@senryo/service-common";
import { buildEvent, sendEvent } from "./asa-client.ts";
import { MS_PER_SECOND, WAIT } from "./constants.ts";
import { freshUser, prepareFork } from "./fork.ts";
import { CHAIN, waitUntil } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18645";
const CARD = process.env.CARD_URL ?? "http://127.0.0.1:3101";
const DB_URL = requireSecret("DATABASE_URL");
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DB_URL)) throw new Error("card-outbox-check runs only on a local database");
const hookSecret = requireSecret("LITHIC_WEBHOOK_SECRET");
const db = createDb(DB_URL, "senryo-drive", 2);
const rpc = { http: [FORK], ws: [] };
const operators = ["OPERATOR_1", "OPERATOR_2"].map((n) => signerFromPrivateKey(requireSecret(`${n}_PK`), n).address);
const placer = createSender({
  chainId: CHAIN,
  account: signerFromPrivateKey(requireSecret("PLACER_PK"), "placer"),
  rpc,
});
const ISSUER_LABEL = "lithic-sandbox";
const USD6 = 1_000_000n;
const CENT = 10_000n;
const DAY_SEC = 86_400n;
const RETRY_WAIT_MS = 120_000;

const CENTS_PER_DOLLAR = 100;
const DAILY_LIMIT_USD = 1_000n;
/** Scenario amounts, in cents. */
const AMOUNTS = {
  capture: { deposit: 3_000, hold: 1_000, clear: 1_100 }, // $11 cleared on a $10 hold, collateral covers it
  refund: 400,
  debt: { deposit: 1_050, hold: 900, clear: 1_080 }, // hold + 20 %: more than the collateral left can pay
} as const;

const usd6 = (cents: number) => BigInt(cents) * CENT;
const centsOf = (amount: bigint) => Number(amount / CENT);
/** "11.00" — the dollars the push title shows. */
const shown = (cents: number) =>
  `${Math.floor(cents / CENTS_PER_DOLLAR)}.${String(cents % CENTS_PER_DOLLAR).padStart(2, "0")}`;
const core = () => readContract(CHAIN, "SenryoCore", placer.read).read;

async function installFaults() {
  await db.unsafe(`
    CREATE OR REPLACE FUNCTION drive_fault_once(name text) RETURNS boolean LANGUAGE plpgsql AS $$
    BEGIN RETURN to_regclass(name) IS NOT NULL AND nextval(name::regclass) = 1; END $$;
    CREATE OR REPLACE FUNCTION drive_hold_fault() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.status = 'CAPTURED' AND OLD.status <> 'CAPTURED' AND drive_fault_once('drive_fault_hold_capture') THEN
        RAISE EXCEPTION 'drive fault: the CAPTURED write fails once';
      END IF;
      RETURN NEW;
    END $$;
    CREATE OR REPLACE FUNCTION drive_ledger_fault() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.ref_type = 'refund' AND drive_fault_once('drive_fault_refund_ledger') THEN
        RAISE EXCEPTION 'drive fault: the refund ledger write fails once';
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS drive_hold_fault ON holds;
    CREATE TRIGGER drive_hold_fault BEFORE UPDATE ON holds FOR EACH ROW EXECUTE FUNCTION drive_hold_fault();
    DROP TRIGGER IF EXISTS drive_ledger_fault ON ledger_entries;
    CREATE TRIGGER drive_ledger_fault BEFORE INSERT ON ledger_entries FOR EACH ROW EXECUTE FUNCTION drive_ledger_fault();
  `);
}

async function removeFaults() {
  await db.unsafe(`
    DROP TRIGGER IF EXISTS drive_hold_fault ON holds;
    DROP TRIGGER IF EXISTS drive_ledger_fault ON ledger_entries;
    DROP SEQUENCE IF EXISTS drive_fault_hold_capture;
    DROP SEQUENCE IF EXISTS drive_fault_refund_ledger;
  `);
}

const arm = (name: "drive_fault_hold_capture" | "drive_fault_refund_ledger") =>
  db.unsafe(`DROP SEQUENCE IF EXISTS ${name}; CREATE SEQUENCE ${name}`);

/** A fresh fork user with `depositUsd` in the trading account and a $1,000 daily limit; a card on file. */
async function setupUser(depositCents: number) {
  const user = freshUser();
  await prepareFork(FORK, [], [user.address]);
  const sender = createSender({ chainId: CHAIN, account: user, rpc });
  const ausd = addressOf(CHAIN, "MockAUSD");
  const deposit = usd6(depositCents);
  await sendAndFinalize(sender, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
  await sendAndFinalize(
    sender,
    contractCall(CHAIN, "MockAUSD", "approve", [addressOf(CHAIN, "SenryoCore"), deposit], "approve"),
  );
  await sendAndFinalize(sender, contractCall(CHAIN, "SenryoCore", "deposit", [ausd, deposit], "deposit"));
  const expiry = BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + DAY_SEC;
  const dailyLimit = DAILY_LIMIT_USD * USD6;
  const signature = await user.signTypedData({
    domain: coreDomain(CHAIN),
    types: SPEND_ALLOWANCE_TYPES,
    primaryType: "SpendAllowance",
    message: { user: user.address, dailyLimit, expiry, nonce: 0n },
  });
  const allowance = [user.address, dailyLimit, expiry, signature] as const;
  await sendAndFinalize(sender, contractCall(CHAIN, "SenryoCore", "setSpendAllowance", allowance, "setSpendAllowance"));
  const cardToken = `drive-outbox-${randomUUID()}`;
  await db`INSERT INTO cards (card_token, issuer, chain_id, account) VALUES (${cardToken}, ${ISSUER_LABEL}, ${CHAIN},
           ${user.address.toLowerCase()})`;
  return { user: user.address, cardToken };
}

/** Place a hold onchain (as the ASA path would) and the rows the service keeps for it. */
async function placeHold(account: string, cardToken: string, amount: bigint, merchant: string) {
  const txnToken = randomUUID();
  const issuer = keccak256(stringToBytes(ISSUER_LABEL));
  const txn = keccak256(stringToBytes(txnToken));
  const holdId = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [issuer, txn]));
  const args = [issuer, txn, account as Hex, amount] as const;
  await sendAndFinalize(placer, contractCall(CHAIN, "SenryoCore", "placeHold", args, "placeHold"));
  const a = account.toLowerCase();
  await db`INSERT INTO holds (hold_id, chain_id, account, issuer, txn_token, amount_usd6, status, expected_usd6)
           VALUES (${holdId}, ${CHAIN}, ${a}, ${ISSUER_LABEL}, ${txnToken}, ${amount}, 'FINALIZED', ${amount})`;
  await db`INSERT INTO card_auth (id, issuer, txn_token, kind, chain_id, card_token, account, amount_cents, currency,
                                  hold_usd6, hold_id, status, result, reason, deadline_at, request)
           VALUES (${randomUUID()}, ${ISSUER_LABEL}, ${txnToken}, 'AUTH', ${CHAIN}, ${cardToken}, ${a},
                   ${centsOf(amount)}, 'USD', ${amount}, ${holdId}, 'APPROVED', 'APPROVED', 'hold finalized', now(),
                   ${db.json({ merchant: { descriptor: merchant } } as never)})`;
  return { holdId, txnToken };
}

interface OutboxRow {
  status: string;
  attempts: number;
  sends: number;
  last_error: string | null;
}

async function outboxRow(kind: string, key: string, value: string): Promise<OutboxRow | undefined> {
  const [row] = await db<OutboxRow[]>`
    SELECT status, attempts, jsonb_array_length(txs)::int AS sends, last_error FROM outbox
     WHERE chain_id = ${CHAIN} AND kind = ${kind} AND payload->>${key} = ${value} ORDER BY id DESC LIMIT 1`;
  return row;
}

const settled = (kind: string, key: string, value: string) =>
  waitUntil(
    async () => {
      const row = await outboxRow(kind, key, value);
      return row && ["DONE", "SKIPPED", "FAILED"].includes(row.status) ? row : undefined;
    },
    RETRY_WAIT_MS,
    WAIT.pollMs,
  );

async function captureFacts(holdId: Hex) {
  const [hold] = await db<{ status: string; captured_usd6: bigint; debt_usd6: bigint }[]>`
    SELECT status, captured_usd6, debt_usd6 FROM holds WHERE hold_id = ${holdId}`;
  const [ledger] = await db<{ groups: bigint; to_float: bigint }[]>`
    SELECT count(DISTINCT entry_group) AS groups,
           COALESCE(SUM(amount_usd6) FILTER (WHERE book = 'card_float' AND direction = 'C'), 0)::bigint AS to_float
      FROM ledger_entries WHERE ref_type = 'captureHold' AND ref_id = ${holdId}`;
  const pushes = await db<{ title: string; body: string }[]>`
    SELECT title, body FROM push_sends WHERE event_key LIKE ${`%card:captured:${holdId}`}`;
  const [onchain] = await readHolds(placer.read, CHAIN, [holdId]);
  return { hold, ledger, pushes, onchain: onchain?.state };
}

async function captureRetry() {
  const a = AMOUNTS.capture;
  const { user, cardToken } = await setupUser(a.deposit);
  const { holdId, txnToken } = await placeHold(user, cardToken, usd6(a.hold), "DRIVE CAFE");
  await arm("drive_fault_hold_capture");
  await sendEvent(CARD, buildEvent(hookSecret, txnToken, cardToken, "CLEARING", a.clear));
  const row = await settled("captureHold", "holdId", holdId);
  const f = await captureFacts(holdId);
  return {
    scenario: "capture-retry",
    row,
    facts: { ...f.hold, ledger: f.ledger, pushes: f.pushes, onchain: f.onchain },
    checks: {
      retriedAfterFault: row?.status === "DONE" && (row?.attempts ?? 0) >= 2,
      oneCaptureSent: row?.sends === 1,
      onchainCaptured: f.onchain === "CAPTURED",
      holdNotLeftOpen: f.hold?.status === "CAPTURED",
      fullCaptureRecorded: f.hold?.captured_usd6 === usd6(a.clear) && f.hold?.debt_usd6 === 0n,
      ledgerOnce: f.ledger?.groups === 1n && f.ledger?.to_float === usd6(a.clear),
      pushOnceWithCapturedAmount: f.pushes.length === 1 && Boolean(f.pushes[0]?.title.includes(shown(a.clear))),
    },
    context: { user, cardToken },
  };
}

async function refundRetry(ctx: { user: string; cardToken: string }) {
  await arm("drive_fault_refund_ledger");
  const before = await core().cardRefunded([ctx.user as Hex]);
  await sendEvent(CARD, buildEvent(hookSecret, randomUUID(), ctx.cardToken, "RETURN", AMOUNTS.refund));
  const row = await settled("refund", "account", ctx.user);
  const [refund] = await db<{ ref_id: Hex; groups: bigint }[]>`
    SELECT ref_id, count(DISTINCT entry_group) AS groups FROM ledger_entries
     WHERE ref_type = 'refund' AND book = ${`user:${ctx.user.toLowerCase()}:free`} GROUP BY ref_id`;
  const after = await core().cardRefunded([ctx.user as Hex]);
  const used = refund ? await core().refundUsed([refund.ref_id]) : false;
  const pushes = refund
    ? await db`SELECT 1 FROM push_sends WHERE event_key LIKE ${`%card:refunded:${refund.ref_id}`}`
    : [];
  // The contract's own guard: the same refId again must revert, whoever sends it.
  let duplicate = "accepted";
  if (refund) {
    const call = contractCall(
      CHAIN,
      "SenryoCore",
      "refund",
      [ctx.user as Hex, refund.ref_id, usd6(AMOUNTS.refund)],
      "refund",
    );
    duplicate = await placer.read
      .call({ account: operators[0] as Hex, to: call.to, data: call.data })
      .then(() => "accepted")
      .catch((error: unknown) => decodeRevert(error)?.name ?? "reverted");
  }
  return {
    scenario: "refund-retry",
    row,
    facts: { refundedOnchain: (after - before).toString(), ledgerGroups: refund?.groups.toString(), duplicate },
    checks: {
      retriedAfterFault: row?.status === "DONE" && (row?.attempts ?? 0) >= 2,
      oneRefundSent: row?.sends === 1,
      refundedOnce: after - before === usd6(AMOUNTS.refund) && used === true,
      ledgerOnce: refund?.groups === 1n,
      pushOnce: pushes.length === 1,
      contractRejectsDuplicate: duplicate === "RefundUsed",
    },
  };
}

async function captureDebt() {
  const a = AMOUNTS.debt;
  const { user, cardToken } = await setupUser(a.deposit);
  const { holdId, txnToken } = await placeHold(user, cardToken, usd6(a.hold), "DRIVE MARKET");
  const debtBefore = (await readAccountSnapshot(placer.read, CHAIN, user, "latest")).cardDebt;
  await sendEvent(CARD, buildEvent(hookSecret, txnToken, cardToken, "CLEARING", a.clear));
  const row = await settled("captureHold", "holdId", holdId);
  const f = await captureFacts(holdId);
  const debt = (await readAccountSnapshot(placer.read, CHAIN, user, "latest")).cardDebt - debtBefore;
  const [debtBook] = await db<{ total: bigint }[]>`
    SELECT COALESCE(SUM(amount_usd6), 0)::bigint AS total FROM ledger_entries
     WHERE ref_type = 'captureHold' AND ref_id = ${holdId} AND book = ${`user:${user.toLowerCase()}:debt`}`;
  return {
    scenario: "capture-debt",
    row,
    facts: { ...f.hold, debtOnchain: debt.toString(), ledger: f.ledger, pushes: f.pushes },
    checks: {
      captured: row?.status === "DONE" && f.hold?.status === "CAPTURED",
      debtCreated: debt > 0n,
      summaryMatchesChain: f.hold?.captured_usd6 === usd6(a.clear) && f.hold?.debt_usd6 === debt,
      ledgerMatchesChain: f.ledger?.to_float === usd6(a.clear) && debtBook?.total === debt,
      pushStatesCaptureAndDebt:
        f.pushes.length === 1 &&
        Boolean(f.pushes[0]?.title.includes(shown(a.clear)) && f.pushes[0]?.body.includes("card debt")),
    },
  };
}

async function stuckScope() {
  const insert = async (chainId: number) => {
    const [row] = await db<{ id: bigint }[]>`
      INSERT INTO outbox (chain_id, kind, dedupe_key, payload, status, attempts, updated_at)
      VALUES (${chainId}, 'releaseHold', ${`drive-stuck:${randomUUID()}`},
              ${db.json({ holdId: keccak256(stringToBytes(randomUUID())), account: operators[0] } as never)},
              'SENDING', 1, now() - interval '10 minutes')
      RETURNING id`;
    return row?.id ?? 0n;
  };
  const other = await insert(MAINNET_CHAIN_ID);
  const own = await insert(CHAIN);
  await waitUntil(
    async () => {
      const [row] = await db<{ attempts: number }[]>`SELECT attempts FROM outbox WHERE id = ${own}`;
      return row && row.attempts > 1 ? true : undefined;
    },
    WAIT.observeMs,
    WAIT.pollMs,
  );
  const [o] = await db<{ status: string; attempts: number }[]>`SELECT status, attempts FROM outbox WHERE id = ${other}`;
  const [s] = await db<{ attempts: number }[]>`SELECT attempts FROM outbox WHERE id = ${own}`;
  await db`DELETE FROM outbox WHERE id IN (${other}, ${own})`;
  return {
    scenario: "stuck-scope",
    facts: { otherNetwork: o, ownNetwork: s },
    checks: {
      ownNetworkReset: (s?.attempts ?? 0) > 1,
      otherNetworkUntouched: o?.status === "SENDING" && o?.attempts === 1,
    },
  };
}

await prepareFork(FORK, [...operators, placer.account.address], []);
await installFaults();
const results: Array<{ scenario: string; checks: Record<string, boolean> }> = [];
try {
  const capture = await captureRetry();
  results.push(capture, await refundRetry(capture.context), await captureDebt(), await stuckScope());
} finally {
  await removeFaults();
}
const pass = results.every((r) => Object.values(r.checks).every(Boolean));
console.log(JSON.stringify({ pass, results }, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
await db.end();
process.exit(pass ? 0 : 1);
