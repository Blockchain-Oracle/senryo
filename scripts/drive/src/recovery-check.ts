/**
 * S8.24 TxRecovery check on an anvil fork of 10143 (local only): `reconcileEntry` reaches the true outcome of a
 * journaled tx and never broadcasts, and the kv journal cap only ever drops settled entries.
 * Broadcasts go through the real sender (`sendTx`, the only write path) and recovery reads the entry IT journaled.
 *  1. a sent success → settled `finalized`;  2. a sent revert (fixed gas, no simulation) → settled `reverted`
 *  3. signed, never broadcast: young → `pending`; old → `abandoned (dropped)`, still unknown to the chain, nonce unused
 *  4. its nonce later used by another tx → `abandoned (nonce-used)`
 *  5. kvJournal at its cap keeps every non-terminal entry and drops the oldest settled ones
 * Run: anvil --fork-url https://testnet-rpc.monad.xyz --port 18765 --block-time 0.5 --mixed-mining --slots-in-an-epoch 1
 *      FORK_RPC=http://127.0.0.1:18765 pnpm --filter @senryo/drive recovery-check
 */
import { randomBytes } from "node:crypto";
import {
  contractCall,
  createReadClient,
  createSender,
  getAddress,
  type Hex,
  JOURNAL_ABANDON_AFTER_MS,
  type JournalEntry,
  keccak256,
  kvJournal,
  LocalNonceSource,
  MemoryJournal,
  type Reconciled,
  reconcileEntry,
  sendTx,
  signerFromPrivateKey,
  type TxRequest,
} from "@senryo/chain";
import { MIN_BASE_FEE_WEI, PRIORITY_FEE_WEI } from "@senryo/config";
import { anvil } from "./fork.ts";
import { CHAIN } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const RICH = "0x8ac7230489e80000";
const KEY_BYTES = 32;
const ADDRESS_BYTES = 20;
const TRANSFER_GAS = 21_000n;
const CALL_GAS = 100_000n;
const SETTLE_POLLS = 120;
const POLL_MS = 250;
/** A max fee well above the 100 gwei floor so the hand-signed (never sent) tx is otherwise valid. */
const FEE_HEADROOM = 3n;
const MAX_FEE = MIN_BASE_FEE_WEI * FEE_HEADROOM;
const HEX_RADIX = 16;
const BYTE_HEX = 2;
const CAP = 50;
const SETTLED_ROWS = 55;
const PENDING_ROWS = 5;

const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const read = createReadClient(CHAIN, { http: [FORK] });
const key = signerFromPrivateKey(`0x${randomBytes(KEY_BYTES).toString("hex")}`, "recovery");
await anvil(FORK, "anvil_setBalance", [key.address, RICH]);
const stranger = () => getAddress(`0x${randomBytes(ADDRESS_BYTES).toString("hex")}`);
const n0 = await read.getTransactionCount({ address: key.address, blockTag: "latest" });
const sent = new MemoryJournal();
const sender = createSender({
  chainId: CHAIN,
  account: key,
  read,
  rpc: { http: [FORK] },
  nonces: new LocalNonceSource(read),
  journal: sent,
});

/** Sends through the real sender and returns the journal entry it wrote. */
async function send(req: TxRequest): Promise<JournalEntry> {
  const tx = await sendTx(sender, req);
  const entry = (await sent.list()).find((e) => e.hash === tx.hash);
  if (!entry) throw new Error(`sender journaled nothing for ${tx.hash}`);
  return entry;
}

/** Signs (never sends) a plain transfer at `nonce`: the entry an app killed before its broadcast leaves behind. */
async function signedOnly(nonce: number): Promise<JournalEntry> {
  const to = stranger();
  const raw = await key.signTransaction({
    chainId: CHAIN,
    type: "eip1559",
    to,
    nonce,
    gas: TRANSFER_GAS,
    maxFeePerGas: MAX_FEE,
    maxPriorityFeePerGas: PRIORITY_FEE_WEI,
  });
  const now = Date.now();
  return {
    hash: keccak256(raw),
    chainId: CHAIN,
    from: key.address,
    to,
    nonce,
    gas: TRANSFER_GAS.toString(),
    action: "transfer",
    raw,
    stage: "submitted",
    createdAt: now,
    updatedAt: now,
  };
}

/** Polls until the entry stops being pending (finality lags proposals by a few blocks on the fork). */
async function settle(entry: JournalEntry): Promise<Reconciled> {
  for (let i = 0; i < SETTLE_POLLS; i += 1) {
    const outcome = await reconcileEntry(read, entry);
    if (outcome.kind !== "pending") return outcome;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { kind: "pending" };
}
const known = async (hash: Hex) => (await read.getTransaction({ hash }).catch(() => undefined)) !== undefined;

// 1 — success (an approve always succeeds).
const ok = await send(contractCall(CHAIN, "MockAUSD", "approve", [stranger(), 1n], "approve"));
const okOutcome = await settle(ok);
record("broadcast success → finalized", okOutcome.kind === "settled" && okOutcome.stage === "finalized");

// 2 — revert: a transfer of tokens it doesn't hold, fixed gas so the sender skips simulation and it lands.
const bad = await send(
  contractCall(CHAIN, "MockAUSD", "transfer", [stranger(), 1n], "approve", { fixedGas: CALL_GAS }),
);
const badOutcome = await settle(bad);
record("broadcast revert → reverted", badOutcome.kind === "settled" && badOutcome.stage === "reverted");

// 3 — signed but never broadcast (the app died before the send).
const lost = await signedOnly(n0 + 2);
const young = await reconcileEntry(read, lost);
record("unbroadcast + young → pending", young.kind === "pending");
const old = await reconcileEntry(read, { ...lost, updatedAt: Date.now() - JOURNAL_ABANDON_AFTER_MS - 1 });
record("unbroadcast + old → abandoned (dropped)", old.kind === "abandoned" && old.reason === "dropped");
const nonceAfter = await read.getTransactionCount({ address: key.address, blockTag: "latest" });
record("never broadcast by recovery", !(await known(lost.hash)) && nonceAfter === n0 + 2, `nonce ${nonceAfter}`);

// 4 — the sender's next tx takes that nonce; the lost one can never land now.
const replacement = await send(contractCall(CHAIN, "MockAUSD", "approve", [stranger(), 1n], "approve"));
record("the next send reused the lost nonce", replacement.nonce === lost.nonce);
await settle(replacement);
const used = await reconcileEntry(read, lost);
record(
  "its nonce used by another tx → abandoned (nonce-used)",
  used.kind === "abandoned" && used.reason === "nonce-used",
);

// 5 — the cap keeps every unresolved entry.
const memory = new Map<string, string>();
const journal = kvJournal({ getItem: (k) => memory.get(k), setItem: (k, v) => void memory.set(k, v) }, "cap", CAP);
const base = Date.now();
const pendingHashes: Hex[] = [];
for (let i = 0; i < SETTLED_ROWS + PENDING_ROWS; i += 1) {
  const pending = i % ((SETTLED_ROWS + PENDING_ROWS) / PENDING_ROWS) === 0;
  const hash = keccak256(`0x${i.toString(HEX_RADIX).padStart(BYTE_HEX, "0")}`);
  if (pending) pendingHashes.push(hash);
  await journal.put({ ...ok, hash, stage: pending ? "submitted" : "finalized", updatedAt: base + i });
}
const kept = await journal.list();
const keptHashes = new Set(kept.map((e) => e.hash));
const oldestSettledGone = !keptHashes.has(keccak256("0x01"));
record(
  "kv journal cap drops only the oldest settled",
  kept.length === CAP && pendingHashes.every((h) => keptHashes.has(h)) && oldestSettledGone,
  `${kept.length} kept, ${pendingHashes.filter((h) => keptHashes.has(h)).length}/${PENDING_ROWS} unresolved kept`,
);

const failed = Object.entries(checks).filter(([, pass]) => !pass);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
