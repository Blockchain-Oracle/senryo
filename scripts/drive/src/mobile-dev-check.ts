/** Exercise the native workspace's public fixture account through the real trade pipeline on its LOCAL fork. */
import assert from "node:assert/strict";
import { AccountClient, DEFAULT_SETTINGS } from "@senryo/account";
import {
  createReadClient,
  createSender,
  decodePerplOrder,
  MemoryJournal,
  perplPracticeFundsRequest,
  planGas,
  readAccountSnapshot,
  readMarketRisk,
  readPerplMarketTerms,
  readPerplSnapshot,
  readPositions,
} from "@senryo/chain";
import { RP_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { capHeadroomUsd6, previewDecrease, previewIncrease } from "@senryo/core";
import {
  closeRequest,
  increaseRequest,
  perplCloseOperation,
  perplOpenOperation,
  perplPnlAtMark,
  perplWithdrawOperation,
  riskViewOf,
  sendTracked,
} from "@senryo/query";
import { memoryStore } from "./fake-passkey.ts";
import { anvil } from "./fork.ts";

const RPC = "http://127.0.0.1:18765";
const ORIGIN = "http://127.0.0.1:18766";
const CHAIN = TESTNET_CHAIN_ID;
const LOCAL_READ_TIMEOUT_MS = 30_000;
const read = createReadClient(CHAIN, { http: [RPC], timeoutMs: LOCAL_READ_TIMEOUT_MS });
assert.match(await anvil<string>(RPC, "web3_clientVersion", []), /anvil/i);
assert.equal(await read.getChainId(), CHAIN);
const CREDENTIAL_BYTES = 16;
const CREDENTIAL_BYTE = 42;
const ROOT_BYTES = 32;
const ROOT_BYTE = 7;
const START_TRADING_USD6 = 75_000_000n;
const NOTIONAL_USD6 = 5_000_000n;
const MOVE_BPS = 100;
const credentialId = () => new Uint8Array(CREDENTIAL_BYTES).fill(CREDENTIAL_BYTE);
const prfOutput = () => new Uint8Array(ROOT_BYTES).fill(ROOT_BYTE);
const client = new AccountClient({
  rpId: RP_ID,
  store: memoryStore(),
  settings: { ...DEFAULT_SETTINGS, faceId: "off" },
  passkey: {
    kind: "web",
    webAuthnClient: {
      createCredential: async () => ({
        credentialId: credentialId(),
        transports: ["internal"],
        prfEnabled: true,
        prfOutput: prfOutput(),
      }),
      getCredential: async () => ({ credentialId: credentialId(), prfOutput: prfOutput() }),
    },
  },
});
const address = await client.create();
console.log("Development account derived; preparing fork");
const control = async (action: string, body: object = {}) => {
  const response = await fetch(`${ORIGIN}/${action}`, { method: "POST", body: JSON.stringify({ address, ...body }) });
  assert.equal(response.ok, true, await response.text());
};
await control("reset");
console.log("Fork prepared");
const initial = await readAccountSnapshot(read, CHAIN, address, "latest");
assert.equal(initial.ausd, START_TRADING_USD6);
assert.equal(initial.positionBitmap, 0);
console.log("Initial balance and empty positions verified");
await control("prepare");
assert.equal((await readAccountSnapshot(read, CHAIN, address, "latest")).ausd, initial.ausd, "Prepare is idempotent");
for (const isLong of [true, false]) {
  console.log(`Reading ${isLong ? "long" : "short"} setup`);
  const market = await readMarketRisk(read, CHAIN, 0);
  assert.equal(market.pv.status, "OPEN");
  const risk = await readAccountSnapshot(read, CHAIN, address, "latest");
  const sender = createSender({
    chainId: CHAIN,
    read,
    rpc: { http: [RPC] },
    journal: new MemoryJournal(),
    account: client.signer(() => ({
      chainId: CHAIN,
      self: address,
      faceId: "off",
      marketRoomUsd6: (_id, long) => capHeadroomUsd6(market.risk, market.book, market.pv, long),
      equityUsd6: () => risk.equityInit,
    })),
  });
  const preview = previewIncrease({
    market: market.risk,
    book: market.book,
    pv: market.pv,
    account: riskViewOf(risk),
    isLong,
    notionalUsd6: NOTIONAL_USD6,
  });
  assert.deepEqual(preview.issues, []);
  const events: string[] = [];
  await sendTracked(sender, increaseRequest(CHAIN, 0, isLong, NOTIONAL_USD6, preview.execPrice18, 1), (e) => {
    events.push(e.stage);
    console.log(`${isLong ? "long" : "short"}: ${e.stage}`);
  });
  const held = (await readPositions(read, CHAIN, address, 1))[0];
  assert.ok(held && held.size > 0n);
  assert.equal(held.isLong, isLong);
  assert.equal(events.at(-1), "finalized");
  await control("price", { marketId: 0, bps: isLong ? MOVE_BPS : -MOVE_BPS });
  const next = await readMarketRisk(read, CHAIN, 0);
  assert.notEqual(next.pv.price18, market.pv.price18);
  const exit = previewDecrease(next.risk, next.pv, held, held.size, 0n);
  await sendTracked(sender, closeRequest(CHAIN, 0, isLong, exit.execPrice18, 1), () => undefined);
  assert.equal((await readAccountSnapshot(read, CHAIN, address, "latest")).positionBitmap, 0);
  console.log(`PASS ${isLong ? "long" : "short"} → finalized position → controlled price change → finalized close`);
}
await control("reset");
assert.equal((await readAccountSnapshot(read, CHAIN, address, "latest")).ausd, START_TRADING_USD6);
assert.equal((await readAccountSnapshot(read, CHAIN, address, "latest")).positionBitmap, 0);
const CRYPTO_MARKET = 256;
const CRYPTO_NOTIONAL_CNS = 100_000_000n;
const CRYPTO_LEVERAGE_HDTHS = 300n;
const CRYPTO_MOVE_BPS = 25;
const WITHDRAW_CNS = 10_000_000n;
const perplSender = createSender({
  chainId: CHAIN,
  read,
  rpc: { http: [RPC] },
  journal: new MemoryJournal(),
  account: client.signer(() => ({
    chainId: CHAIN,
    self: address,
    faceId: "off",
    marketRoomUsd6: () => undefined,
    equityUsd6: () => undefined,
  })),
});
const execute = async (
  plan:
    | Awaited<ReturnType<typeof perplOpenOperation>>
    | Awaited<ReturnType<typeof perplCloseOperation>>
    | Awaited<ReturnType<typeof perplWithdrawOperation>>,
) => {
  assert.equal(plan.blocker, undefined);
  let order: ReturnType<typeof decodePerplOrder> | undefined;
  for (const step of plan.steps) {
    const request = typeof step === "function" ? await step() : step;
    const result = await sendTracked(perplSender, request, () => undefined);
    assert.equal(result.final?.stage, "finalized");
    if (request.action === "perplOrder")
      order = decodePerplOrder((await read.getTransactionReceipt({ hash: result.hash })).logs, CHAIN);
  }
  return order;
};
const faucetRequest = perplPracticeFundsRequest("0x5e9104c0c0a0b0000000000000000000000dd1d0");
assert.ok((await planGas(perplSender, faucetRequest)) <= (faucetRequest.gasCap ?? 0n));
console.log("PASS native test-AUSD faucet encoding, simulation and explicit gas cap");
for (const side of ["long", "short"] as const) {
  const open = await perplOpenOperation(read, address, {
    chainId: CHAIN,
    marketId: CRYPTO_MARKET,
    side,
    notionalCNS: CRYPTO_NOTIONAL_CNS,
    leverageHdths: CRYPTO_LEVERAGE_HDTHS,
  });
  const fill = await execute(open);
  assert.ok(fill && (fill.kind === "filled" || fill.kind === "partial"), "IOC must actually fill");
  const before = (await readPerplSnapshot(read, CHAIN, address)).positions.find((p) => p.marketId === CRYPTO_MARKET);
  assert.ok(before && before.side === side);
  await control("perpl-price", { marketId: CRYPTO_MARKET, bps: side === "long" ? CRYPTO_MOVE_BPS : -CRYPTO_MOVE_BPS });
  // The fixture admin confirms inclusion; money snapshots deliberately read the finalized head.
  let moved = (await readPerplSnapshot(read, CHAIN, address)).positions.find((p) => p.marketId === CRYPTO_MARKET);
  const FINALITY_ATTEMPTS = 20;
  const FINALITY_POLL_MS = 500;
  for (let attempt = 0; moved?.markPricePNS === before.markPricePNS && attempt < FINALITY_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, FINALITY_POLL_MS));
    moved = (await readPerplSnapshot(read, CHAIN, address)).positions.find((p) => p.marketId === CRYPTO_MARKET);
  }
  console.log(
    `Perpl ${side} marks ${before.markPricePNS} → ${moved?.markPricePNS}; PnL ${before.pnlCNS} → ${moved?.pnlCNS}`,
  );
  assert.ok(moved && moved.pnlCNS > before.pnlCNS, "Favourable mark movement must improve both long and short PnL");
  const terms = await readPerplMarketTerms(read, CHAIN, CRYPTO_MARKET);
  const estimated = perplPnlAtMark(before, moved.markPricePNS, terms);
  assert.ok(
    estimated - moved.pnlCNS <= 2n && moved.pnlCNS - estimated <= 2n,
    "Live PnL agrees with contract within two micro AUSD",
  );
  const close = await execute(await perplCloseOperation(read, address, { chainId: CHAIN, marketId: CRYPTO_MARKET }));
  assert.ok(close && (close.kind === "filled" || close.kind === "partial"));
  assert.equal((await readPerplSnapshot(read, CHAIN, address)).positions.length, 0);
  console.log(`PASS native Perpl Practice ${side}: actual fill → controlled mark → contract PnL → actual close`);
}
await execute(await perplWithdrawOperation(read, address, WITHDRAW_CNS, CHAIN));
await control("reset");
assert.equal((await readPerplSnapshot(read, CHAIN, address)).positions.length, 0);
console.log("PASS Perpl withdrawal and isolated reset");
client.session.dispose();
console.log("PASS reset balances/positions; public fixture account, local Anvil only");
