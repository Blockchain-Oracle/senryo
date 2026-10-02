/**
 * Composed operations on a LOCAL anvil fork of Monad mainnet (never a real network): the app's composer
 * (`@senryo/query` compose.ts) with live Monorail / KyberSwap quotes (the any-asset routes in-process), every step sent
 * through `@senryo/chain` and journalled the way the app journals it (one operation id, one reviewed intent).
 *  1. B11 network fee: a plain EOA (as app accounts are — the app never signs an EIP-7702 delegation) holding USDC and
 *     MON below the fee reserve sends USDC. The plan prepends "~$0.50 USDC → MON"; one operation runs
 *     [approve?, Network fee swap] → Send in that order; the recipient gets the exact amount; the reserve is restored.
 *     With MON for the send and the reserve the plan is "covered"; with 0 MON it is "too-low" (named, no dead end).
 *  2. MON reserve: a MON-paid pool deposit runs the MON swap FIRST and keeps ≥ 10 MON; a MON spend into the reserve is
 *     refused before signing (MonReserveError); a MON value step placed after another one that would dip below the
 *     reserve is refused by the order check (MonOrderError).
 *  3. Pay with any asset (FORK_BOOK = the fork's 143.json from Deploy.s.sol + SeedMainnet.s.sol, never committed):
 *     pool deposit paying with MON (swap → approve → deposit) and an XAU long paying with USDC (swap → approve → move
 *     to trading → open); the swap is re-quoted right before signing and the reviewed intent names the asset and the
 *     minimum received.
 *   anvil --fork-url https://rpc.monad.xyz --network monad --port 18790   (+ deploy, see the stage doc)
 *   MAINNET_FORK_RPC=http://127.0.0.1:18790 FORK_BOOK=…/143.json pnpm --filter @senryo/drive compose-fork-check
 */
import { readFileSync } from "node:fs";
import {
  createReadClient,
  erc20Abi,
  externalCall,
  MonReserveError,
  prepareAggregatorSwap,
  readAccountSnapshot,
  readLpVault,
  readMarketRisk,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL, MAINNET_TOKENS, NATIVE_TOKEN } from "@senryo/config";
import { previewIncrease } from "@senryo/core";
import {
  assertMonOrder,
  type ComposedStep,
  composeSteps,
  feeReserveWei,
  increaseRequest,
  lpApproveRequest,
  lpDepositRequest,
  MonOrderError,
  moveToTradingSteps,
  operationFeeNeed,
  planNetworkFee,
  type QueryEnv,
  riskViewOf,
  runOperationSteps,
  swapLeg,
} from "@senryo/query";
import { type AddressBook, addressBooks } from "../../../packages/contracts/src/addresses/index.ts";
import { configureOperationStorage } from "../../../packages/query/src/operations.ts";
import { openAnyAssetHarness } from "../../../services/api/scripts/anyasset-harness.ts";
import { forkKit } from "./compose-fork-lib.ts";
import { anvil, freshUser } from "./fork.ts";

const FORK = process.env.MAINNET_FORK_RPC;
if (!FORK) {
  console.error("MAINNET_FORK_RPC (a local anvil fork of 143) is required");
  process.exit(1);
}
const BOOK = process.env.FORK_BOOK;
if (BOOK) (addressBooks as Record<number, AddressBook>)[MAINNET_CHAIN_ID] = JSON.parse(readFileSync(BOOK, "utf8"));

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
const TRADE_USDC = 10_000_000n;
/** Monorail's `InsufficientLiquidity()` selector (an order-book hop priced on the live chain, missing on the fork). */
const INSUFFICIENT_LIQUIDITY = "0xbb55fd27";
const DRIFT_ATTEMPTS = 3;
const LEVERAGE = 2n;
const XAU = 0;

const fork = createReadClient(MAINNET_CHAIN_ID, { http: [FORK] });
const live = await openAnyAssetHarness({});
const env = { chainId: MAINNET_CHAIN_ID, read: fork, mainnetRead: fork, api: live.api } as unknown as QueryEnv;
const data = new Map<string, string>();
configureOperationStorage({
  get: (k) => data.get(k),
  set: (k, v) => {
    data.set(k, v);
  },
  keys: () => [...data.keys()],
});

const { failures, check, lend, balanceOf, journalled, mine, userSender, checkOperation, swapQuote, keepFinalizing } =
  forkKit(FORK, fork, live.api);

const stopMining = keepFinalizing();

// ---------------------------------------------------------------- 1. B11 network fee
console.log(`\n# 1. network fee on ${FORK}`);
const send = (to: string): ComposedStep => ({
  role: "act",
  action: "erc20Transfer",
  label: "Send",
  request: externalCall(MAINNET_TOKENS.usdc, erc20Abi, "transfer", [to as `0x${string}`, SEND_USD6], "erc20Transfer", {
    meta: { kind: "send", amount: SEND_USD6.toString(), symbol: "USDC", recipient: to, source: "wallet" },
  }),
});

/** Fork drift: a route priced on the live chain can lack its liquidity on a fork minutes behind — re-quote, retry. */
async function withDrift(label: string, scenario: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await scenario();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(INSUFFICIENT_LIQUIDITY) || attempt >= DRIFT_ATTEMPTS) throw error;
      console.log(`~ ${label}: fork drift (${INSUFFICIENT_LIQUIDITY}) — fresh account, fresh quote`);
    }
  }
}

await withDrift("network fee", async () => {
  const payer = freshUser();
  const payerSender = userSender(payer);
  await lend(MAINNET_EXTERNAL.uniswapV4.poolManager, MAINNET_TOKENS.usdc, payer.address, USDC_FUNDING);
  const sendStep = send(OTHER);
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
});

// ---------------------------------------------------------------- 2. MON reserve rule
console.log("\n# 2. MON reserve");
const monUser = freshUser();
await anvil(FORK, "anvil_setBalance", [monUser.address, hex(USER_MON)]);
let refused = false;
try {
  const greedy = await swapQuote(NATIVE_TOKEN, MAINNET_TOKENS.ausd, USER_MON - LEAVES_5_MON, monUser.address);
  await prepareAggregatorSwap(fork, monUser.address, {
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
const approveFirst: ComposedStep = { role: "move", action: "approve", label: "Approve", request: send(OTHER).request };
let ordered = false;
try {
  assertMonOrder([approveFirst, valueStep], ORDER_BALANCE, [ORDER_BUDGET, ORDER_BUDGET]);
} catch (error) {
  ordered = error instanceof MonOrderError;
}
check(ordered, "a MON spend after another step that dips below the reserve is refused by the order check");
assertMonOrder([valueStep, approveFirst], ORDER_BALANCE, [ORDER_BUDGET, ORDER_BUDGET]);
check(true, "the same MON spend placed first passes the order check");

// ---------------------------------------------------------------- 3. pay with any asset (needs the fork's deploy)
if (!BOOK) {
  console.log("\n~ FORK_BOOK unset: pay-with-any-asset legs skipped (they need SenryoCore / LpVault on the fork)");
} else {
  await withDrift("pay with MON → pool", async () => {
    const monUser = freshUser();
    await anvil(FORK, "anvil_setBalance", [monUser.address, hex(USER_MON)]);
    console.log("\n# 3a. pool deposit paying with MON");
    const monSender = userSender(monUser);
    const q = await swapQuote(NATIVE_TOKEN, MAINNET_TOKENS.ausd, POOL_MON, monUser.address);
    const swap = await swapLeg(env, monUser.address, q, { approve: "Approve MON", swap: "Swap MON → AUSD" }, "swap");
    const vault = (addressBooks[MAINNET_CHAIN_ID]?.contracts.LpVault?.address ?? "0x") as `0x${string}`;
    const deposit = q.quote.minOut;
    const act: ComposedStep[] = [
      {
        role: "act",
        action: "approve",
        label: "Approve AUSD",
        request: lpApproveRequest(MAINNET_CHAIN_ID, vault, deposit),
      },
      {
        role: "act",
        action: "lpDeposit",
        label: "Deposit",
        request: lpDepositRequest(MAINNET_CHAIN_ID, deposit, monUser.address),
      },
    ];
    const steps = composeSteps({ swap, act });
    check(steps[0]?.request.value === POOL_MON, "the MON-spending swap is the first step");
    assertMonOrder(steps, USER_MON, (await operationFeeNeed(fork, monUser.address, steps)).budgetsWei);
    const intent = {
      kind: "lpDeposit",
      payWith: "MON",
      paid: POOL_MON.toString(),
      minReceived: q.quote.minOut.toString(),
      destination: "pool",
    };
    const key = `143:pool-pay-with:${monUser.address}`;
    await runOperationSteps(steps, intent, journalled(monSender, key), { read: fork, waitForBlock: mine });
    const record = checkOperation("MON → pool", monUser.address, key, steps);
    check(
      record?.reviewedIntent.payWith === "MON" && record.reviewedIntent.minReceived === q.quote.minOut.toString(),
      "the reviewed intent names MON and the minimum received",
    );
    const pool = await readLpVault(fork, MAINNET_CHAIN_ID, monUser.address);
    check(pool.shares > 0n, `pool shares minted (${pool.shares})`);
    const monLeft = await fork.getBalance({ address: monUser.address });
    check(monLeft >= RESERVE, `≥ 10 MON kept after the MON-paid operation (${monLeft})`);
  });

  await withDrift("pay with USDC → XAU", async () => {
    console.log("\n# 3b. XAU long paying with USDC");
    const trader = freshUser();
    const traderSender = userSender(trader);
    await anvil(FORK, "anvil_setBalance", [trader.address, hex(USER_MON)]);
    await lend(MAINNET_EXTERNAL.uniswapV4.poolManager, MAINNET_TOKENS.usdc, trader.address, USDC_FUNDING);
    const tq = await swapQuote(MAINNET_TOKENS.usdc, MAINNET_TOKENS.ausd, TRADE_USDC, trader.address);
    const tswap = await swapLeg(env, trader.address, tq, { approve: "Approve USDC", swap: "Swap USDC → AUSD" }, "swap");
    const margin = tq.quote.minOut;
    const move = moveToTradingSteps(MAINNET_CHAIN_ID, "AUSD", margin, 0n);
    const market = await readMarketRisk(fork, MAINNET_CHAIN_ID, XAU, "latest");
    if (market.pv.status !== "OPEN") {
      console.log(`~ XAU is ${market.pv.status} on the fork: the open leg is skipped (run while metals trade)`);
    }
    const account = await readAccountSnapshot(fork, MAINNET_CHAIN_ID, trader.address, "latest");
    // The fill price depends on the market, not the account: preview now, the core re-checks margin at the open.
    const notional = margin * LEVERAGE;
    const preview = previewIncrease({
      market: market.risk,
      book: market.book,
      pv: market.pv,
      account: riskViewOf(account),
      isLong: true,
      notionalUsd6: notional,
    });
    const open: ComposedStep[] =
      market.pv.status === "OPEN"
        ? [
            {
              role: "act",
              action: "increase",
              label: "Open",
              request: increaseRequest(MAINNET_CHAIN_ID, XAU, true, notional, preview.execPrice18, 1),
            },
          ]
        : [];
    const tsteps = composeSteps({ swap: tswap, move, act: open });
    const tintent = {
      kind: "increase",
      marketId: String(XAU),
      side: "long",
      payWith: "USDC",
      paid: TRADE_USDC.toString(),
      minReceived: margin.toString(),
      marginUsd6: margin.toString(),
      notionalUsd6: notional.toString(),
    };
    const tkey = `143:ticket-pay-with:${trader.address}`;
    await runOperationSteps(tsteps, tintent, journalled(traderSender, tkey), { read: fork, waitForBlock: mine });
    const trecord = checkOperation("USDC → trading → open", trader.address, tkey, tsteps);
    const lastSwap = tsteps.findLastIndex((s) => s.role === "swap");
    const firstMove = tsteps.findIndex((s) => s.role === "move");
    const firstAct = tsteps.findIndex((s) => s.role === "act");
    check(
      lastSwap < firstMove && (firstAct === -1 || tsteps.findLastIndex((s) => s.role === "move") < firstAct),
      `swap → move → open (${tsteps.map((s) => s.label).join(" → ")})`,
    );
    check(
      trecord?.reviewedIntent.payWith === "USDC" && trecord.reviewedIntent.minReceived === margin.toString(),
      "the reviewed intent names USDC and the minimum received",
    );
    const after = await readAccountSnapshot(fork, MAINNET_CHAIN_ID, trader.address, "latest");
    check(
      after.ausd >= margin || after.positionBitmap !== 0,
      `the swapped AUSD is in the trading account (${after.ausd})`,
    );
    if (open.length > 0) check(after.positionBitmap !== 0, "the XAU long is open");
  });
}

stopMining();
await live.close();
console.log(
  failures.length === 0 ? "\nall checks passed" : `\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
