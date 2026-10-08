/**
 * S3 gate (plan "S3 Services"): a brand-new wallet, through the public api only, on Monad testnet —
 * sign in → Practice dollars → a BTC 1m Up with a gas-free permit → fill → cash out half → a Down in the same window →
 * the keeper settles and pays automatically → a capped session → a call signed by the session key.
 * Prints every step's tx and the tap → fill time. `API_ORIGIN` (default http://localhost:3310).
 *
 *   pnpm --filter @senryo/drive exec tsx src/markets-public-check.ts
 */
import {
  authNonceRoute,
  authVerifyRoute,
  callTimelineRoute,
  catalogRoute,
  createApiClient,
  grantSessionRoute,
  intentStatusRoute,
  marketAccountRoute,
  practiceGrantRoute,
  submitIntentRoute,
  ticketsRoute,
} from "@senryo/api-client";
import {
  ACTION_CLOSE,
  ACTION_OPEN,
  freshNonce,
  intentRequest,
  permitParts,
  permitRequest,
  seriesIdOf,
  sessionGrantRequest,
  windowIdOf,
} from "@senryo/chain";
import { BAND_INDEX, DOLLAR_DECIMALS, explorerTxUrl, TESTNET_CHAIN_ID } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { generatePrivateKey, type PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";
import { sleep } from "./lib.ts";

const CHAIN = TESTNET_CHAIN_ID;
const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3310";
const SYMBOL = "BTC";
const CADENCE = 60;
const STAKE = 5_000_000n;
const PERMIT_VALUE = 100_000_000n;
const MIN_LEFT_SEC = 42;
const POLL_MS = 250;
const FILL_TIMEOUT_MS = 30_000;
/** The indexer follows the head within a couple of seconds (D-279). */
const INDEX_WAIT_MS = 10_000;
const SETTLE_TIMEOUT_MS = 120_000;
const DEADLINE_SEC = 90;
const SESSION_SEC = 900;
const MS = 1000;
const STEP_COL = 28;
const SHOWN_DECIMALS = 2;
/** A close needs the position held ≥ 3 s (contracts `MIN_HOLD_SEC`); wait a little longer. */
const HOLD_SEC = 4;
const NOTE_COL = 30;

let token: string | undefined;
const api = createApiClient({ origin: ORIGIN, getToken: () => token });
const owner = privateKeyToAccount(generatePrivateKey());
const delegate = privateKeyToAccount(generatePrivateKey());
const rows: Array<{ step: string; tx: string | null; ms?: number }> = [];

function log(step: string, tx: string | null, extra = "", ms?: number) {
  rows.push({ step, tx, ...(ms === undefined ? {} : { ms }) });
  console.log(`  ✓ ${step.padEnd(STEP_COL)} ${extra.padEnd(NOTE_COL)} ${tx ? explorerTxUrl(CHAIN, tx) : ""}`);
}

async function account() {
  return api.call(marketAccountRoute, { query: { chainId: CHAIN, owner: owner.address } });
}

/** The current BTC 1m window if it has time left, else the next one (waits for it). */
async function window(): Promise<{ start: number; windowId: `0x${string}` }> {
  let now = Math.floor(Date.now() / MS);
  let start = now - (now % CADENCE);
  if (start + CADENCE - now < MIN_LEFT_SEC) {
    start += CADENCE;
    await sleep((start - now + 2) * MS);
    now = Math.floor(Date.now() / MS);
  }
  return { start, windowId: windowIdOf(seriesIdOf(SYMBOL, CADENCE), start) };
}

async function signIntent(signer: PrivateKeyAccount, intent: Parameters<typeof submitIntent>[0]) {
  return signer.signTypedData(intentRequest(CHAIN, intent));
}

async function submitIntent(
  intent: {
    action: number;
    owner: `0x${string}`;
    windowId: `0x${string}`;
    band: number;
    ticketId: bigint;
    amount: bigint;
    limit: bigint;
    recipient: `0x${string}`;
    configVersion: number;
    deadline: bigint;
    nonce: bigint;
    epoch: number;
  },
  signer: PrivateKeyAccount,
  start: number,
  permit: { value: bigint; deadline: bigint; v: number; r: `0x${string}`; s: `0x${string}` } | null,
) {
  const signature = await signIntent(signer, intent);
  const tapped = Date.now();
  const status = await api.call(submitIntentRoute, {
    body: {
      chainId: CHAIN,
      intent: { ...intent, action: intent.action as 1 | 2 },
      signature,
      permit,
      symbol: SYMBOL,
      cadenceSec: CADENCE,
      start,
    },
  });
  const deadline = Date.now() + FILL_TIMEOUT_MS;
  let s = status;
  let committedTx: string | null = null;
  while (Date.now() < deadline) {
    s = await api.call(intentStatusRoute, { params: { digest: status.digest } });
    if (s.state === "committed" && !committedTx) committedTx = s.txHash;
    if (s.state === "filled" || s.state === "refused" || s.state === "failed") break;
    await sleep(POLL_MS);
  }
  const tapToDoneMs = Date.now() - tapped;
  if (!committedTx && s.ticketId !== null) committedTx = await indexedCommitTx(s.ticketId);
  return { ...s, committedTx, tapToDoneMs };
}

/** The commit tx when polling missed the brief "committed" state: the indexer's call timeline has it (S4). */
async function indexedCommitTx(ticketId: bigint): Promise<string | null> {
  const until = Date.now() + INDEX_WAIT_MS;
  while (Date.now() < until) {
    const found = await api
      .call(callTimelineRoute, { params: { ticketId }, query: { chainId: CHAIN } })
      .catch(() => undefined);
    if (found) return found.call.commitTx;
    await sleep(POLL_MS);
  }
  return null;
}

async function main() {
  console.log(`markets public check — ${ORIGIN}, owner ${owner.address}`);
  const nonce = await api.call(authNonceRoute, { body: { address: owner.address, chainId: CHAIN } });
  const verified = await api.call(authVerifyRoute, {
    body: { message: nonce.message, signature: await owner.signMessage({ message: nonce.message }) },
  });
  token = verified.token;
  log("sign in (SIWE)", null, verified.address);

  const grant = await api.call(practiceGrantRoute, {});
  if (grant.state !== "granted") throw new Error(`practice grant: ${grant.state}`);
  log("practice dollars", grant.txHash, `${formatUnits(grant.amount, DOLLAR_DECIMALS, SHOWN_DECIMALS)} tUSD`);

  const catalog = await api.call(catalogRoute, { query: { chainId: CHAIN } });
  const acct = await account();
  const { start, windowId } = await window();
  const base = { owner: owner.address, windowId, recipient: owner.address, configVersion: catalog.configVersion };

  // 1 — Up with a permit (the finite allowance in the same transaction).
  const permitDeadline = BigInt(Math.floor(Date.now() / MS) + DEADLINE_SEC);
  const permit = permitParts(
    await owner.signTypedData(
      permitRequest(CHAIN, {
        owner: owner.address,
        spender: catalog.contracts.reserve,
        value: PERMIT_VALUE,
        nonce: acct.permitNonce,
        deadline: permitDeadline,
      }),
    ),
  );
  const deadline = () => BigInt(Math.floor(Date.now() / MS) + DEADLINE_SEC);
  const up = await submitIntent(
    {
      ...base,
      action: ACTION_OPEN,
      band: BAND_INDEX.up,
      ticketId: 0n,
      amount: STAKE,
      limit: 0n,
      deadline: deadline(),
      nonce: freshNonce(),
      epoch: acct.epoch,
    },
    owner,
    start,
    { value: PERMIT_VALUE, deadline: permitDeadline, ...permit },
  );
  if (up.state !== "filled") throw new Error(`up: ${up.state} ${up.reason}`);
  log("commit Up $5 (+ permit)", up.committedTx, `ticket ${up.ticketId}`);
  log("fill at the unique print", up.txHash, `tap → fill ${up.tapToDoneMs} ms`, up.tapToDoneMs);

  // 2 — cash out half after the minimum hold.
  await sleep(HOLD_SEC * MS);
  const mine = await api.call(ticketsRoute, { query: { chainId: CHAIN, owner: owner.address } });
  const upTicket = mine.tickets.find((t) => t.ticketId === up.ticketId);
  if (!upTicket) throw new Error("up ticket missing from /tickets");
  const close = await submitIntent(
    {
      ...base,
      action: ACTION_CLOSE,
      band: 0,
      ticketId: upTicket.ticketId,
      amount: upTicket.payout / 2n,
      limit: 0n,
      deadline: deadline(),
      nonce: freshNonce(),
      epoch: acct.epoch,
    },
    owner,
    start,
    null,
  );
  if (close.state !== "filled") throw new Error(`close: ${close.state} ${close.reason}`);
  log(
    "cash out half",
    close.txHash,
    `${formatUnits(upTicket.payout / 2n, DOLLAR_DECIMALS, SHOWN_DECIMALS)} shares sold`,
  );

  // 3 — a Down in the same window (allowance left from the permit).
  const down = await submitIntent(
    {
      ...base,
      action: ACTION_OPEN,
      band: BAND_INDEX.down,
      ticketId: 0n,
      amount: STAKE,
      limit: 0n,
      deadline: deadline(),
      nonce: freshNonce(),
      epoch: acct.epoch,
    },
    owner,
    start,
    null,
  );
  if (down.state !== "filled") throw new Error(`down: ${down.state} ${down.reason}`);
  log("commit + fill Down $5", down.txHash, `tap → fill ${down.tapToDoneMs} ms`, down.tapToDoneMs);

  // 4 — the keeper settles the window and pays automatically.
  const settleBy = Date.now() + SETTLE_TIMEOUT_MS;
  let settled = false;
  while (Date.now() < settleBy && !settled) {
    await sleep(2 * MS);
    const t = await api.call(ticketsRoute, { query: { chainId: CHAIN, owner: owner.address } });
    settled = t.tickets
      .filter((x) => x.ticketId === up.ticketId || x.ticketId === down.ticketId)
      .every((x) => x.state === "settled");
    if (settled)
      for (const x of t.tickets)
        console.log(`    ticket ${x.ticketId}: ${x.state} ${x.outcome ?? ""} result ${x.result ?? 0n}`);
  }
  if (!settled) throw new Error("the keeper did not settle within 2 minutes");
  log("settled + paid automatically", null, "both tickets settled");

  // 5 — a capped session; the delegate key calls without the owner.
  const session = {
    owner: owner.address,
    delegate: delegate.address,
    perCallCap: 25_000_000n,
    sessionCap: 100_000_000n,
    expiry: BigInt(Math.floor(Date.now() / MS) + SESSION_SEC),
    epoch: acct.epoch,
    nonce: freshNonce(),
  };
  const sessionSig = await owner.signTypedData(sessionGrantRequest(CHAIN, session));
  const granted = await api.call(grantSessionRoute, {
    body: { chainId: CHAIN, grant: session, signature: sessionSig, permit: null },
  });
  log("session grant ($25 / $100 / 15m)", granted.txHash, granted.state);
  const next = await window();
  const viaSession = await submitIntent(
    {
      ...base,
      windowId: next.windowId,
      action: ACTION_OPEN,
      band: BAND_INDEX.up,
      ticketId: 0n,
      amount: STAKE,
      limit: 0n,
      deadline: deadline(),
      nonce: freshNonce(),
      epoch: acct.epoch,
    },
    delegate,
    next.start,
    null,
  );
  if (viaSession.state !== "filled") throw new Error(`session call: ${viaSession.state} ${viaSession.reason}`);
  log("session-key call + fill", viaSession.txHash, `tap → fill ${viaSession.tapToDoneMs} ms`, viaSession.tapToDoneMs);

  const end = await account();
  console.log(
    `\nbalance ${formatUnits(end.balance, DOLLAR_DECIMALS, SHOWN_DECIMALS)} tUSD · session spent ${formatUnits(end.session?.spent ?? 0n, DOLLAR_DECIMALS, SHOWN_DECIMALS)}`,
  );
  console.log(JSON.stringify({ owner: owner.address, rows }, null, 2));
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});
