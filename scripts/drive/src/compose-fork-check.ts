/**
 * Composed operations on a LOCAL anvil fork of Monad mainnet (never a real network): the app's composer (`@senryo/query`
 * compose.ts), live aggregator quotes, every step sent through `@senryo/chain` and journalled as the app does (one
 * operation id, one reviewed intent, steps in order).
 *  1. B11: a plain EOA below the fee reserve sends USDC — "~$0.50 USDC → MON" goes first in the same operation, the
 *     reserve comes back; covered with MON; named "too-low" at 0 MON.
 *  2. MON reserve: a MON spend into the 10 MON floor is refused before signing; the order check refuses a MON spend
 *     after another step; paying with MON runs the MON swap first and keeps ≥ 10 MON.
 *  3. (DEPLOY_STACK=1) Pay with any asset — pool deposit with USDT0, an XAU long with USDC (compose-fork-pay.ts).
 *   anvil --fork-url https://rpc.monad.xyz --network monad --slots-in-an-epoch 1 --port 18790
 *   MAINNET_FORK_RPC=http://127.0.0.1:18790 [DEPLOY_STACK=1] pnpm --filter @senryo/drive compose-fork-check
 */
import { createReadClient, erc20Abi, externalCall, MonReserveError, prepareAggregatorSwap } from "@senryo/chain";
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL, MAINNET_TOKENS, NATIVE_TOKEN, type SwapProvider } from "@senryo/config";
import {
  assertMonOrder,
  type ComposedStep,
  composeSteps,
  feeReserveWei,
  MonOrderError,
  operationFeeNeed,
  planNetworkFee,
  type QueryEnv,
  runOperationSteps,
  swapLeg,
} from "@senryo/query";
import { configureOperationStorage } from "../../../packages/query/src/operations.ts";
import { openAnyAssetHarness } from "../../../services/api/scripts/anyasset-harness.ts";
import { driftRetry, forkKit } from "./compose-fork-lib.ts";
import { payWithAnyAsset } from "./compose-fork-pay.ts";
import { anvil, freshUser } from "./fork.ts";

const FORK = process.env.MAINNET_FORK_RPC;
if (!FORK) {
  console.error("MAINNET_FORK_RPC (a local anvil fork of 143) is required");
  process.exit(1);
}

const OTHER = "0x00000000000000000000000000000000000000A1";
const SEND_USD6 = 20_000_000n;
const USDC_FUNDING = 30_000_000n;
const TOP_UP_USD6 = 500_000n;
const POOL_MON = 15_000_000_000_000_000_000n;
const USER_MON = 30_000_000_000_000_000_000n;
/** Enough for estimating, before the balance is set below the reserve. */
const PROBE_MON = 10_000_000_000_000_000_000n;
/** A MON swap that would leave 5 MON: into the 10 MON reserve. */
const LEAVES_5_MON = 5_000_000_000_000_000_000n;
/** The order check: 12 MON, a 3 MON spend, 0.1 MON per step budget. */
const ORDER_BALANCE = 12_000_000_000_000_000_000n;
const ORDER_VALUE = 3_000_000_000_000_000_000n;
const ORDER_BUDGET = 100_000_000_000_000_000n;
const HEX_RADIX = 16;
const hex = (n: bigint) => `0x${n.toString(HEX_RADIX)}`;
const RESERVE = 10_000_000_000_000_000_000n;
const _TRADE_USDC = 10_000_000n;
const _POOL_USDT0 = 10_000_000n;
const UPSTREAM = process.env.MAINNET_UPSTREAM_RPC ?? "https://rpc.monad.xyz";
const _LEVERAGE = 2n;
const _XAU = 0;

const fork = createReadClient(MAINNET_CHAIN_ID, { http: [FORK] });
// Kuru's order book (Monorail's usual hop to MON) moves every block and can't be replayed on a fork even seconds old;
// KyberSwap's AMM routes can, through the same pinned-router path the app signs. SWAP_PROVIDERS overrides.
const providers = (process.env.SWAP_PROVIDERS ?? "kyberswap").split(",") as SwapProvider[];
const live = await openAnyAssetHarness({}, providers);
const env = { chainId: MAINNET_CHAIN_ID, read: fork, mainnetRead: fork, api: live.api } as unknown as QueryEnv;
const data = new Map<string, string>();
configureOperationStorage({
  get: (k) => data.get(k),
  set: (k, v) => {
    data.set(k, v);
  },
  keys: () => [...data.keys()],
});

const kit = forkKit(FORK, fork, live.api);
const { failures, check, lend, balanceOf, journalled, mine, userSender, checkOperation, swapQuote, keepFinalizing } =
  kit;

const miner = keepFinalizing();

// ---------------------------------------------------------------- 1. B11 network fee (run after part 3, on a re-fork)
const send = (to: string, amount: bigint): ComposedStep => ({
  role: "act",
  action: "erc20Transfer",
  label: "Send",
  request: externalCall(MAINNET_TOKENS.usdc, erc20Abi, "transfer", [to as `0x${string}`, amount], "erc20Transfer", {
    meta: { kind: "send", amount: amount.toString(), symbol: "USDC", recipient: to, source: "wallet" },
  }),
});

const { withDrift } = driftRetry(FORK, UPSTREAM);

const feeScenario = async () => {
  const payer = freshUser();
  const payerSender = userSender(payer);
  await lend(MAINNET_EXTERNAL.uniswapV4.poolManager, MAINNET_TOKENS.usdc, payer.address, USDC_FUNDING);
  const sendStep = send(OTHER, SEND_USD6);
  // No blocks while the window is measured and planned: an empty block moves the base fee, and with it both sides.
  miner.stop();
  const reserve = await feeReserveWei(fork);
  await anvil(FORK, "anvil_setBalance", [payer.address, hex(PROBE_MON)]);
  const need = (await operationFeeNeed(fork, payer.address, [sendStep])).needWei;
  // MON for the send, but below send + reserve: the operation must top up first.
  const startMon = need + reserve - 1n;
  await anvil(FORK, "anvil_setBalance", [payer.address, hex(startMon)]);
  console.log(`send needs ${need} wei; reserve ${reserve} wei; account holds ${startMon} wei`);
  const sources = [
    { address: MAINNET_TOKENS.usdc, symbol: "USDC", decimals: 6, spare: USDC_FUNDING - SEND_USD6 },
  ] as const;
  const plan = await planNetworkFee(env, payer.address, [sendStep], sources);
  miner.start();
  check(plan.kind === "top-up", `MON below the reserve → top-up planned (${plan.kind})`);
  if (plan.kind === "top-up") {
    check(plan.amountIn === TOP_UP_USD6, `~$0.50 of USDC (${plan.amountIn})`);
    check(
      plan.steps.every((s) => s.role === "fee" && s.label === "Network fee"),
      `fee steps labelled "Network fee" (${plan.steps.map((s) => s.action).join(", ")})`,
    );
    const steps = composeSteps({ fee: plan.steps, act: [sendStep] });
    check(
      steps.at(-1) === steps.find((s) => s.label === "Send") && steps[0]?.role === "fee",
      "the fee goes first, the act last",
    );
    const budgets = (await operationFeeNeed(fork, payer.address, steps)).budgetsWei;
    assertMonOrder(steps, startMon, budgets, plan.quote.quote.minOut);
    const usdcBefore = await balanceOf(MAINNET_TOKENS.usdc, payer.address);
    const otherBefore = await balanceOf(MAINNET_TOKENS.usdc, OTHER);
    let settled = false;
    const key = `143:fee-send:${payer.address}`;
    await runOperationSteps(
      steps,
      { kind: "send", amount: SEND_USD6.toString(), symbol: "USDC", recipient: OTHER, source: "wallet" },
      journalled(payerSender, key),
      {
        read: fork,
        waitForBlock: async () => {
          settled = true;
          await mine();
        },
      },
    );
    checkOperation("fee + send", payer.address, key, steps);
    check(settled, "waited for the new MON to settle before the send");
    const got = (await balanceOf(MAINNET_TOKENS.usdc, OTHER)) - otherBefore;
    check(got === SEND_USD6, `recipient got exactly ${got} (20 USDC)`);
    const spent = usdcBefore - (await balanceOf(MAINNET_TOKENS.usdc, payer.address));
    check(spent === SEND_USD6 + TOP_UP_USD6, `the account paid 20 USDC + 0.50 USDC (${spent})`);
    const monAfter = await fork.getBalance({ address: payer.address });
    check(monAfter >= reserve, `the fee reserve is back (${monAfter} ≥ ${reserve})`);
    const again = await planNetworkFee(env, payer.address, [sendStep], sources);
    check(again.kind === "covered", `with MON for the send and the reserve: covered (${again.kind})`);
  }
  await anvil(FORK, "anvil_setBalance", [payer.address, "0x0"]);
  const dry = await planNetworkFee(env, payer.address, [sendStep], sources);
  check(
    dry.kind === "short" && dry.reason === "too-low",
    `0 MON: can't buy MON by itself → named (${dry.kind}${dry.kind === "short" ? ` ${dry.reason}` : ""})`,
  );
};

// ---------------------------------------------------------------- 2. MON reserve rule
const reserveRules = async () => {
  const u = freshUser();
  await anvil(FORK, "anvil_setBalance", [u.address, hex(USER_MON)]);
  let refused = false;
  try {
    const greedy = await swapQuote(NATIVE_TOKEN, MAINNET_TOKENS.ausd, USER_MON - LEAVES_5_MON, u.address);
    await prepareAggregatorSwap(fork, u.address, {
      ...greedy.quote,
      tokenIn: greedy.from.address,
      amountIn: greedy.amountIn,
    });
  } catch (error) {
    refused = error instanceof MonReserveError;
  }
  check(refused, "a MON swap into the 10 MON reserve is refused before signing");
  const valueStep: ComposedStep = {
    role: "act",
    action: "transfer",
    label: "Send MON",
    request: { to: OTHER, data: "0x", value: ORDER_VALUE, action: "transfer" },
  };
  const approveFirst: ComposedStep = {
    role: "move",
    action: "approve",
    label: "Approve",
    request: send(OTHER, SEND_USD6).request,
  };
  let ordered = false;
  try {
    assertMonOrder([approveFirst, valueStep], ORDER_BALANCE, [ORDER_BUDGET, ORDER_BUDGET]);
  } catch (error) {
    ordered = error instanceof MonOrderError;
  }
  check(ordered, "a MON spend after another step that dips below the reserve is refused by the order check");
  assertMonOrder([valueStep, approveFirst], ORDER_BALANCE, [ORDER_BUDGET, ORDER_BUDGET]);
  check(true, "the same MON spend placed first passes the order check");
};

/** Pay with MON → send USDC: the MON-spending swap goes first and the account keeps ≥ 10 MON. */
const monFirstScenario = async () => {
  const u = freshUser();
  await anvil(FORK, "anvil_setBalance", [u.address, hex(USER_MON)]);
  const q = await swapQuote(NATIVE_TOKEN, MAINNET_TOKENS.usdc, POOL_MON, u.address);
  const swap = await swapLeg(env, u.address, q, { approve: "Approve MON", swap: "Swap MON → USDC" }, "swap");
  const steps = composeSteps({ swap, act: [send(OTHER, q.quote.minOut)] });
  check(steps[0]?.request.value === POOL_MON, "paying with MON: the MON-spending swap is the first step");
  assertMonOrder(steps, USER_MON, (await operationFeeNeed(fork, u.address, steps)).budgetsWei);
  const otherBefore = await balanceOf(MAINNET_TOKENS.usdc, OTHER);
  const key = `143:mon-first:${u.address}`;
  const intent = {
    kind: "send",
    payWith: "MON",
    amount: q.quote.minOut.toString(),
    symbol: "USDC",
    recipient: OTHER,
    source: "wallet",
  };
  await runOperationSteps(steps, intent, journalled(userSender(u), key), { read: fork, waitForBlock: mine });
  checkOperation("MON → send USDC", u.address, key, steps);
  check(
    (await balanceOf(MAINNET_TOKENS.usdc, OTHER)) - otherBefore === q.quote.minOut,
    "the recipient got the reviewed minimum",
  );
  const left = await fork.getBalance({ address: u.address });
  check(left >= RESERVE, `≥ 10 MON kept after the MON-paid operation (${left})`);
};

// Start the fork right before the run: quotes price the live chain.
const parts = (process.env.PARTS ?? "1,2,3").split(",");
if (parts.includes("1")) {
  console.log(`\n# 1. network fee on ${FORK}`);
  await withDrift("network fee", feeScenario, false);
}
if (parts.includes("2")) {
  console.log("\n# 2. MON reserve");
  await reserveRules();
  await withDrift("pay with MON → send", monFirstScenario, false);
}
if (process.env.DEPLOY_STACK && parts.includes("3")) await payWithAnyAsset(FORK, env, kit);
else
  console.log(
    "\n~ DEPLOY_STACK unset: pay-with-any-asset (part 3) skipped — it deploys the stack on the fork with forge",
  );

miner.stop();
await live.close();
console.log(
  failures.length === 0 ? "\nall checks passed" : `\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
