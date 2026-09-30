/**
 * S8.10/S8.11 ticket path on an anvil fork of 10143 (local only, no api): the apps' exact composition — Mera
 * `AccountClient` on a virtual PRF authenticator, the scoped signer with the ticket's TradeContext (market room +
 * equity, so the session policy signs an in-scope open without a prompt), `increaseRequest` / `closeRequest` with
 * per-position gas, `sendTracked` for the execution trace — then a full close by the same path.
 * Run: anvil --fork-url https://testnet-rpc.monad.xyz --network monad --port 18765 --block-time 0.5 --mixed-mining
 *        --slots-in-an-epoch 1;  FORK_RPC=http://127.0.0.1:18765 pnpm ticket-e2e
 */
import { AccountClient, type PolicyContext, queuedNonces } from "@senryo/account";
import {
  addressOf,
  contractCall,
  createReadClient,
  createSender,
  LocalNonceSource,
  MemoryJournal,
  readAccountSnapshot,
  readMarketRisk,
  readPositions,
  sendAndFinalize,
} from "@senryo/chain";
import { RP_ID } from "@senryo/config";
import { capHeadroomUsd6, previewDecrease, previewIncrease } from "@senryo/core";
import { closeRequest, increaseRequest, riskViewOf, sendTracked } from "@senryo/query";
import { memoryStore, VirtualAuthenticator } from "./fake-passkey.ts";
import { anvil } from "./fork.ts";
import { CHAIN } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const RICH = "0x8ac7230489e80000";
const DEPOSIT_USD6 = 25_000_000n;
const TRADE_NOTIONAL_USD6 = 20_000_000n;
const XAU = 0;
const TRACE = ["checking", "signing", "signed", "proposed", "voted", "finalized"];

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

client.session.dispose();
const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
