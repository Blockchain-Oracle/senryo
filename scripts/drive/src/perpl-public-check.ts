/**
 * Public Perpl journey on Monad testnet (real venues, Stage 1) — the app's own planners and sender against the live
 * exchange, its real market maker and the deployed api, with a brand-new wallet:
 *   sign in → starter claim (gas) → Get test money (10,000 test AUSD) → gas top-ups as each send needs them →
 *   open BTC long (approve · createAccount · IOC) → close 50 % → close the rest → withdraw everything to the wallet.
 * Every transaction prints with its explorer link. Spends testnet MON from the starter float only.
 *   API_URL=https://api.senryo.xyz pnpm --filter @senryo/drive perpl-public-check
 */
import assert from "node:assert/strict";
import {
  ApiError,
  authNonceRoute,
  authVerifyRoute,
  createApiClient,
  perplFundsRoute,
  type RelayResponse,
  starterClaimRoute,
  starterRelayRoute,
  starterTopUpRoute,
} from "@senryo/api-client";
import {
  createReadClient,
  createSender,
  decodePerplOrder,
  FeeCache,
  MemoryJournal,
  planGas,
  readPerplSnapshot,
  starterDripDomain,
  type TxRequest,
} from "@senryo/chain";
import { explorerTxUrl, PERPL_TESTNET_FAUCET_CNS, TESTNET_CHAIN_ID } from "@senryo/config";
import { CLAIM_TYPES, isTerminalStage, TOPUP_TYPES } from "@senryo/core";
import { perplCloseOperation, perplOpenOperation, perplWithdrawOperation, sendTracked } from "@senryo/query";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const API = process.env.API_URL ?? "https://api.senryo.xyz";
const CHAIN = TESTNET_CHAIN_ID;
const BTC = 16;
const NOTIONAL_CNS = 300_000_000n; // $300 of BTC
const LEVERAGE_HDTHS = 300n; // 3×
const HALF_BPS = 5_000n;
const MS = 1_000;
const DEADLINE_TTL_S = 300n;
const POLL_MAX = 60;

const user = privateKeyToAccount(generatePrivateKey());
const read = createReadClient(CHAIN);
const fees = new FeeCache(read);
const sender = createSender({ chainId: CHAIN, read, journal: new MemoryJournal(), account: user });
let token: string | null = null;
const api = createApiClient({ origin: API, deviceHash: `perpl-public-${Date.now()}`, getToken: () => token });
const deadline = () => BigInt(Math.floor(Date.now() / MS)) + DEADLINE_TTL_S;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function settle(relay: RelayResponse, label: string): Promise<RelayResponse> {
  let r = relay;
  for (let i = 0; i < POLL_MAX && !isTerminalStage(r.stage); i++) {
    await sleep(MS);
    r = await api.call(starterRelayRoute, { params: { relayId: r.relayId } });
  }
  console.log(`${label}: ${r.stage} ${explorerTxUrl(CHAIN, r.txHash)}`);
  assert.equal(r.stage, "finalized", `${label} ${r.stage}`);
  return r;
}

/** The app's preflight: when the next send's gas budget exceeds the wallet, ask the api for a top-up first. */
async function ensureGas(request: TxRequest) {
  const need = (await planGas(sender, request)) * (await fees.get()).maxFeePerGas;
  if ((await read.getBalance({ address: user.address })) >= need) return;
  const d = deadline();
  const signature = await user.signTypedData({
    domain: starterDripDomain(CHAIN),
    types: TOPUP_TYPES,
    primaryType: "TopUp",
    message: { user: user.address, needWei: need, deadline: d },
  });
  const relay = await api.call(starterTopUpRoute, {
    body: { chainId: CHAIN, user: user.address, needWei: need, deadline: d, signature },
  });
  await settle(relay, `gas top-up ${relay.nativeWei} wei`);
}

let spentWei = 0n;
async function run(
  label: string,
  plan: { steps: (TxRequest | (() => Promise<TxRequest>))[]; blocker?: string | undefined },
) {
  assert.equal(plan.blocker, undefined, `${label} blocked: ${plan.blocker}`);
  let order: ReturnType<typeof decodePerplOrder> | undefined;
  for (const step of plan.steps) {
    const request = typeof step === "function" ? await step() : step;
    await ensureGas(request);
    const before = await read.getBalance({ address: user.address });
    const result = await sendTracked(sender, request, () => undefined);
    assert.equal(result.final?.stage, "finalized", `${label} ${request.action} ${result.final?.stage}`);
    spentWei += before - (await read.getBalance({ address: user.address }));
    console.log(`${label} · ${request.action}: ${explorerTxUrl(CHAIN, result.hash)}`);
    if (request.action === "perplOrder")
      order = decodePerplOrder((await read.getTransactionReceipt({ hash: result.hash })).logs, CHAIN);
  }
  return order;
}

// 1. Sign in, starter claim (gas), Get test money.
const nonce = await api.call(authNonceRoute, { body: { address: user.address, chainId: CHAIN } });
token = (
  await api.call(authVerifyRoute, {
    body: { message: nonce.message, signature: await user.signMessage({ message: nonce.message }) },
  })
).token;
const d = deadline();
const claimSig = await user.signTypedData({
  domain: starterDripDomain(CHAIN),
  types: CLAIM_TYPES,
  primaryType: "Claim",
  message: { user: user.address, deadline: d },
});
const claim = await api
  .call(starterClaimRoute, { body: { chainId: CHAIN, user: user.address, deadline: d, signature: claimSig } })
  .catch((e: unknown) => e);
if (claim instanceof ApiError) console.log(`starter claim refused here (${claim.code}); gas comes from top-ups`);
else await settle(claim as RelayResponse, "starter claim");
await settle(await api.call(perplFundsRoute, { body: { chainId: CHAIN } }), "test money");
assert.equal((await readPerplSnapshot(read, CHAIN, user.address)).wallet.balance, PERPL_TESTNET_FAUCET_CNS);

// 2. Open, close half, close the rest.
const opened = await run(
  "open BTC long $300 3×",
  await perplOpenOperation(read, user.address, {
    chainId: CHAIN,
    marketId: BTC,
    side: "long",
    notionalCNS: NOTIONAL_CNS,
    leverageHdths: LEVERAGE_HDTHS,
  }),
);
assert.ok(opened && (opened.kind === "filled" || opened.kind === "partial"), `open ${opened?.kind}`);
const full = (await readPerplSnapshot(read, CHAIN, user.address)).positions.find((p) => p.marketId === BTC);
assert.ok(full, "position opened");
console.log(`position: ${full.lots} lots · entry ${full.entryPricePNS} · pnl ${full.pnlCNS}`);

await run(
  "close 50%",
  await perplCloseOperation(read, user.address, { chainId: CHAIN, marketId: BTC, shareBps: HALF_BPS }),
);
const half = (await readPerplSnapshot(read, CHAIN, user.address)).positions.find((p) => p.marketId === BTC);
assert.ok(half && half.lots < full.lots, "half closed");
console.log(`after half close: ${half.lots} lots`);

await run("close rest", await perplCloseOperation(read, user.address, { chainId: CHAIN, marketId: BTC }));
const after = await readPerplSnapshot(read, CHAIN, user.address);
assert.equal(after.positions.length, 0, "no position left");

// 3. Withdraw everything free back to the wallet.
const available = after.account?.availableCNS ?? 0n;
await run("withdraw", await perplWithdrawOperation(read, user.address, available, CHAIN));
const final = await readPerplSnapshot(read, CHAIN, user.address);
console.log(
  `PASS public Perpl journey for ${user.address}: wallet ${final.wallet.balance} CNS (started ${PERPL_TESTNET_FAUCET_CNS}); MON spent ${spentWei} wei`,
);
