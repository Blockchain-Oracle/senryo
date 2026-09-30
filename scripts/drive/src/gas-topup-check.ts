/**
 * S8.16b/c gas check on an anvil fork of 10143 (local only, no api). Reproduces the phone bug, then proves the fix:
 *  1. A fresh practice account holding only the 0.05 MON drip cannot pay an open's budget (gas LIMIT × the max fee
 *     the sender signs — anvil enforces exactly the standard `balance ≥ limit × maxFee` rule, the strictest reading of
 *     Monad's consensus check).
 *  2. The api's top-up math (`planTopUp`: need × GAS_TOPUP_ACTIONS − balance, clamped to the drip's per-day cap)
 *     leaves enough for the open, which then finalizes through the app's exact send path (`sendTracked`).
 *  3. The close is budgeted the same way and finalizes.
 * Anvil lets the base fee decay toward 0, so the check pins Monad's 100 gwei floor before budgeting and before each
 * send; a closed market is warped to its next open and gets a fresh mirror round (keeper key, fork only).
 * Run: anvil --fork-url https://testnet-rpc.monad.xyz --network monad --port 18765 --block-time 0.5 --mixed-mining
 *        --slots-in-an-epoch 1;  FORK_RPC=http://127.0.0.1:18765 KEEPER_PK_FILE=… pnpm gas-topup-check
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
  readCalendar,
  readContract,
  readMarketRisk,
  readPositions,
  sendAndFinalize,
  signerFromPrivateKey,
} from "@senryo/chain";
import { GAS_TOPUP_ACTIONS, MIN_BASE_FEE_WEI, RP_ID } from "@senryo/config";
import { capHeadroomUsd6, nextTransition, previewDecrease, previewIncrease, RISK } from "@senryo/core";
import { closeRequest, gasBudgetFor, increaseRequest, riskViewOf, sendTracked, userFeeCache } from "@senryo/query";
import { requireSecret } from "@senryo/service-common";
import { E18_TO_FEED } from "./constants.ts";
import { memoryStore, VirtualAuthenticator } from "./fake-passkey.ts";
import { anvil } from "./fork.ts";
import { CHAIN } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const RICH = "0x8ac7230489e80000";
const DEPOSIT_USD6 = 25_000_000n;
const TRADE_NOTIONAL_USD6 = 20_000_000n;
const XAU = 0;
/** Monad: a newly funded account spends after 3 blocks (mirrored here so the flow matches the app). */
const SETTLE_BLOCKS = "0x3";
const HEX_RADIX = 16;
const toHex = (v: bigint) => `0x${v.toString(HEX_RADIX)}`;
const WARP_SLACK_SEC = 60n;
const MS_PER_SECOND = 1000;
/** Monad's min base fee (100 gwei); anvil would otherwise decay it toward 0 on empty blocks. */
const pinBaseFee = async () => {
  await anvil(FORK, "anvil_setNextBlockBaseFeePerGas", [toHex(MIN_BASE_FEE_WEI)]);
  await anvil(FORK, "anvil_mine", ["0x1"]);
  await anvil(FORK, "anvil_setNextBlockBaseFeePerGas", [toHex(MIN_BASE_FEE_WEI)]);
};

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
const nonces = queuedNonces(new LocalNonceSource(read));
const base = (): PolicyContext => ({
  chainId: CHAIN,
  self: address,
  faceId: "off",
  marketRoomUsd6: () => undefined,
  equityUsd6: () => undefined,
});
const senderWith = (ctx: () => PolicyContext) =>
  createSender({
    chainId: CHAIN,
    account: client.signer(ctx),
    read,
    rpc: { http: [FORK] },
    nonces,
    journal: new MemoryJournal(),
    // Exactly as the app: the user fee quote the budget uses is the one the sender signs with (D-171).
    fees: userFeeCache(read),
  });

// Collateral in the core, as after a practice claim + deposit.
const funding = senderWith(base);
const core = addressOf(CHAIN, "SenryoCore");
await sendAndFinalize(funding, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
await sendAndFinalize(funding, contractCall(CHAIN, "MockAUSD", "approve", [core, DEPOSIT_USD6], "approve"));
await sendAndFinalize(
  funding,
  contractCall(CHAIN, "SenryoCore", "deposit", [addressOf(CHAIN, "MockAUSD"), DEPOSIT_USD6], "deposit"),
);

// Trade in an OPEN session: warp a closed market to its next open, then a fresh mirror round (keeper, fork only).
const keeperKey = signerFromPrivateKey(requireSecret("KEEPER_PK"), "keeper");
await anvil(FORK, "anvil_setBalance", [keeperKey.address, RICH]);
const keeper = createSender({
  chainId: CHAIN,
  account: keeperKey,
  read,
  rpc: { http: [FORK] },
  journal: new MemoryJournal(),
});
const before = await readMarketRisk(read, CHAIN, XAU, "latest");
if (before.pv.status !== "OPEN") {
  const calendar = await readCalendar(read, CHAIN, before.calendarId);
  const now = (await read.getBlock({ blockTag: "latest" })).timestamp;
  const opensAt = nextTransition(calendar, now, true);
  if (opensAt !== undefined) {
    // Past the reopen window (REOPENING → OPEN), then the app's wall-clock deadlines follow the fork's clock.
    const target = opensAt + RISK.REOPEN_WINDOW + WARP_SLACK_SEC;
    await anvil(FORK, "evm_setNextBlockTimestamp", [toHex(target)]);
    await anvil(FORK, "anvil_mine", ["0x1"]);
    const offsetMs = Number(target) * MS_PER_SECOND - Date.now();
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + offsetMs;
  }
}
await sendAndFinalize(
  keeper,
  contractCall(CHAIN, "MirrorXAU", "pushAnswer", [before.pv.price18 / E18_TO_FEED], "pushAnswer"),
);
await sendAndFinalize(keeper, contractCall(CHAIN, "SessionOracle", "observe", [XAU], "observe"));
await pinBaseFee();

// 1 — the phone state: only the drip's MON left.
const drip = readContract(CHAIN, "StarterDrip", read);
const [dripWei, , topUpCapWei] = await drip.read.config();
await anvil(FORK, "anvil_setBalance", [address, toHex(dripWei)]);
const xau = await readMarketRisk(read, CHAIN, XAU, "latest");
const acct = await readAccountSnapshot(read, CHAIN, address, "latest");
const open = previewIncrease({
  market: xau.risk,
  book: xau.book,
  pv: xau.pv,
  account: riskViewOf(acct),
  isLong: true,
  notionalUsd6: TRADE_NOTIONAL_USD6,
});
const openReq = increaseRequest(CHAIN, XAU, true, TRADE_NOTIONAL_USD6, open.execPrice18, 1);
const openBudget = await gasBudgetFor(read, address, openReq);
record("market is OPEN for the check", xau.pv.status === "OPEN", xau.pv.status);
record(
  "bug reproduced: the drip alone can't cover an open's budget",
  openBudget.needWei > dripWei,
  `need ${openBudget.needWei} (limit ${openBudget.limit} × ${openBudget.maxFeePerGas}) vs drip ${dripWei}`,
);

// 2 — the api's top-up math, then the open through the app's send path.
const want = openBudget.needWei * GAS_TOPUP_ACTIONS - dripWei;
const amount = want < topUpCapWei ? want : topUpCapWei;
await anvil(FORK, "anvil_setBalance", [address, toHex(dripWei + amount)]);
await anvil(FORK, "anvil_mine", [SETTLE_BLOCKS]);
await pinBaseFee();
record("top-up covers the open", dripWei + amount >= openBudget.needWei, `topped up ${amount} (cap ${topUpCapWei})`);
const trade = senderWith(() => ({
  ...base(),
  marketRoomUsd6: (_id, long) => capHeadroomUsd6(xau.risk, xau.book, xau.pv, long),
  equityUsd6: () => acct.equityInit,
  marketLabel: () => "Gold",
}));
const openStages: string[] = [];
await sendTracked(trade, openReq, (e) => openStages.push(e.stage));
const bitmap = (await readAccountSnapshot(read, CHAIN, address, "latest")).positionBitmap;
const held = (await readPositions(read, CHAIN, address, bitmap)).find((p) => p.marketId === XAU);
record(
  "open finalizes after the top-up",
  openStages.at(-1) === "finalized" && held !== undefined,
  openStages.join(" → "),
);

// 3 — the close is budgeted the same way.
if (held) {
  const exit = previewDecrease(xau.risk, (await readMarketRisk(read, CHAIN, XAU)).pv, held, held.size, 0n);
  const closeReq = closeRequest(CHAIN, XAU, true, exit.execPrice18, 1);
  const closeBudget = await gasBudgetFor(read, address, closeReq);
  const balance = await read.getBalance({ address });
  record(
    "remaining balance covers the close (no second top-up needed)",
    balance >= closeBudget.needWei,
    `balance ${balance} vs close need ${closeBudget.needWei}`,
  );
  const closeStages: string[] = [];
  await pinBaseFee();
  await sendTracked(trade, closeReq, (e) => closeStages.push(e.stage));
  record("close finalizes", closeStages.at(-1) === "finalized", closeStages.join(" → "));
}

client.session.dispose();
const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
