/**
 * S8.10/S8.11 ticket path on an anvil fork of 10143 (local only, no api): the apps' exact composition — Mera
 * `AccountClient` on a virtual PRF authenticator, the scoped signer with the ticket's TradeContext (market room +
 * equity, so the session policy signs an in-scope open without a prompt), `increaseRequest` / `closeRequest` with
 * per-position gas, `sendTracked` for the execution trace — then a full close by the same path.
 * Run: anvil --fork-url https://testnet-rpc.monad.xyz --network monad --port 18765 --block-time 0.5 --mixed-mining
 *        --slots-in-an-epoch 1;  FORK_RPC=http://127.0.0.1:18765 KEEPER_PK_FILE=… pnpm ticket-e2e
 */
import { AccountClient, type PolicyContext, queuedNonces } from "@senryo/account";
import {
  addressOf,
  CONTRACT_ABIS,
  contractCall,
  createReadClient,
  createSender,
  LocalNonceSource,
  MemoryJournal,
  readAccountSnapshot,
  readMarketRisk,
  readPositions,
  receiptEvents,
  sendAndFinalize,
  signerFromPrivateKey,
} from "@senryo/chain";
import { RP_ID } from "@senryo/config";
import { capHeadroomUsd6, previewDecrease, previewIncrease, RISK } from "@senryo/core";
import {
  cancelTriggerRequest,
  closeRequest,
  increaseRequest,
  placeTriggerRequest,
  riskViewOf,
  sendTracked,
  triggerOrder,
} from "@senryo/query";
import { requireSecret } from "@senryo/service-common";
import { memoryStore, VirtualAuthenticator } from "./fake-passkey.ts";
import { anvil } from "./fork.ts";
import { CHAIN } from "./lib.ts";
import { walkTo } from "./oracle-walk.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const RICH = "0x8ac7230489e80000";
const DEPOSIT_USD6 = 25_000_000n;
const TRADE_NOTIONAL_USD6 = 20_000_000n;
const XAU = 0;
const TRACE = ["checking", "signing", "signed", "proposed", "voted", "finalized"];
/** TP 5 % above, SL 1 % below the oracle; `PositionKind.TRIGGER` in Types.sol. */
const TP_BPS = 500n;
const SL_BPS = 100n;
const TRIGGER_KIND = 5;

const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const auth = new VirtualAuthenticator();
const client = new AccountClient({ rpId: RP_ID, passkey: { kind: "web", webAuthnClient: auth }, store: memoryStore() });
const address = await client.create();
await anvil(FORK, "anvil_setBalance", [address, RICH]);
const read = createReadClient(CHAIN, { http: [FORK] });
const base = (): PolicyContext => ({
  chainId: CHAIN,
  self: address,
  faceId: "off",
  marketRoomUsd6: () => undefined,
  equityUsd6: () => undefined,
});
const nonces = queuedNonces(new LocalNonceSource(read));
const senderWith = (ctx: () => PolicyContext) =>
  createSender({
    chainId: CHAIN,
    account: client.signer(ctx),
    read,
    rpc: { http: [FORK] },
    nonces,
    journal: new MemoryJournal(),
  });

// Fund like the app's Add money: faucet + approve + deposit, all in scope (no prompt).
const funding = senderWith(base);
const core = addressOf(CHAIN, "SenryoCore");
await sendAndFinalize(funding, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
await sendAndFinalize(funding, contractCall(CHAIN, "MockAUSD", "approve", [core, DEPOSIT_USD6], "approve"));
await sendAndFinalize(
  funding,
  contractCall(CHAIN, "SenryoCore", "deposit", [addressOf(CHAIN, "MockAUSD"), DEPOSIT_USD6], "deposit"),
);
record("fund: faucet + approve + deposit in scope (only the create prompt)", auth.ceremonies === 1);

// Open exactly as useTicket does.
const xau = await readMarketRisk(read, CHAIN, XAU, "latest");
const acct = await readAccountSnapshot(read, CHAIN, address, "latest");
const trade = senderWith(() => ({
  ...base(),
  marketRoomUsd6: (_id, long) => capHeadroomUsd6(xau.risk, xau.book, xau.pv, long),
  equityUsd6: () => acct.equityInit,
  marketLabel: () => "Gold",
}));
const open = previewIncrease({
  market: xau.risk,
  book: xau.book,
  pv: xau.pv,
  account: riskViewOf(acct),
  isLong: true,
  notionalUsd6: TRADE_NOTIONAL_USD6,
});
const openStages: string[] = [];
await sendTracked(trade, increaseRequest(CHAIN, XAU, true, TRADE_NOTIONAL_USD6, open.execPrice18, 1), (e) =>
  openStages.push(e.stage),
);
const bitmap = (await readAccountSnapshot(read, CHAIN, address, "latest")).positionBitmap;
const held = (await readPositions(read, CHAIN, address, bitmap)).find((p) => p.marketId === XAU);
record(
  "open: in scope with market room + equity (no prompt); trace in order",
  auth.ceremonies === 1 && JSON.stringify(openStages) === JSON.stringify(TRACE) && held !== undefined,
  openStages.join(" → "),
);

// Close exactly as usePosition does (reduce is always in scope).
if (held) {
  const exit = previewDecrease(xau.risk, (await readMarketRisk(read, CHAIN, XAU)).pv, held, held.size, 0n);
  const closeStages: string[] = [];
  await sendTracked(trade, closeRequest(CHAIN, XAU, true, exit.execPrice18, 1), (e) => closeStages.push(e.stage));
  const after = await readAccountSnapshot(read, CHAIN, address, "latest");
  record(
    "close: in scope, finalized, no position left",
    auth.ceremonies === 1 && closeStages.at(-1) === "finalized" && after.positionBitmap === 0,
    closeStages.join(" → "),
  );
}

// TP/SL (F14): re-open; a TP is placed (signed in session) and cancelled; an SL 1 % below is placed, the oracle walks
// through it, and anyone's `executeTrigger` closes the position with a TRIGGER fill.
const keeperKey = signerFromPrivateKey(requireSecret("KEEPER_PK"), "keeper");
await anvil(FORK, "anvil_setBalance", [keeperKey.address, RICH]);
const keeper = createSender({
  chainId: CHAIN,
  account: keeperKey,
  read,
  rpc: { http: [FORK] },
  journal: new MemoryJournal(),
});
const reopen = await readMarketRisk(read, CHAIN, XAU, "latest");
const reAcct = await readAccountSnapshot(read, CHAIN, address, "latest");
const again = previewIncrease({
  market: reopen.risk,
  book: reopen.book,
  pv: reopen.pv,
  account: riskViewOf(reAcct),
  isLong: true,
  notionalUsd6: TRADE_NOTIONAL_USD6,
});
await sendTracked(trade, increaseRequest(CHAIN, XAU, true, TRADE_NOTIONAL_USD6, again.execPrice18, 1), () => undefined);
const pos = (await readPositions(read, CHAIN, address, 1)).find((p) => p.marketId === XAU);
if (!pos) throw new Error("re-open failed");
const orderIdOf = (receipt: Parameters<typeof receiptEvents>[0]) => {
  const placed = receiptEvents(receipt, "SenryoCore").find((e) => e.eventName === "TriggerPlaced");
  return (placed?.args as { orderId: `0x${string}` } | undefined)?.orderId;
};
const active = (id: `0x${string}`) =>
  read.readContract({ address: core, abi: CONTRACT_ABIS.SenryoCore, functionName: "triggerActive", args: [id] });
const tpOrder = triggerOrder({
  user: address,
  marketId: XAU,
  isLong: true,
  takeProfit: true,
  triggerPrice18: (reopen.pv.price18 * (RISK.BPS + TP_BPS)) / RISK.BPS,
  sizeDelta: pos.size,
});
const tp = await sendTracked(trade, await placeTriggerRequest(trade, tpOrder), () => undefined);
const tpId = orderIdOf(tp.receipt);
const tpActive = tpId ? await active(tpId) : false;
if (tpId) await sendTracked(trade, cancelTriggerRequest(CHAIN, tpId), () => undefined);
const tpAfter = tpId ? await active(tpId) : true;
record("TP placed in scope (no prompt) and cancelled", auth.ceremonies === 1 && tpActive && !tpAfter);

const slPrice = (reopen.pv.price18 * (RISK.BPS - SL_BPS)) / RISK.BPS;
const slOrder = triggerOrder({
  user: address,
  marketId: XAU,
  isLong: true,
  takeProfit: false,
  triggerPrice18: slPrice,
  sizeDelta: pos.size,
});
const sl = await sendTracked(trade, await placeTriggerRequest(trade, slOrder), () => undefined);
const slId = orderIdOf(sl.receipt);
await walkTo(read, keeper, XAU, (slPrice * (RISK.BPS - SL_BPS)) / RISK.BPS);
const exec = slId
  ? await sendAndFinalize(keeper, contractCall(CHAIN, "SenryoCore", "executeTrigger", [slId], "executeTrigger"))
  : undefined;
const fill = exec
  ? receiptEvents(exec.receipt, "SenryoCore").find((e) => e.eventName === "PositionUpdated")
  : undefined;
const kind = (fill?.args as { kind: number } | undefined)?.kind;
const flat = (await readAccountSnapshot(read, CHAIN, address, "latest")).positionBitmap === 0;
record(
  "SL executes when the oracle crosses: TRIGGER fill, position closed",
  kind === TRIGGER_KIND && flat,
  `kind ${kind}`,
);

client.session.dispose();
const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
