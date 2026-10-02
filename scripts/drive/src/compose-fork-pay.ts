/**
 * Part 3 of compose-fork-check: "Pay with any asset" on a LOCAL anvil fork of 143. The Senryo stack isn't on Mainnet
 * yet, so the fork deploys it (Deploy.s.sol + SeedMainnet.s.sol, throwaway deployer, nothing broadcast to a real
 * network; the fork's 143.json and broadcasts are removed from the worktree right after). Live aggregator quotes go
 * stale on a fork while it deploys, so each operation's swap step runs FIRST and the deploy happens while both
 * operations wait at their next step — still one operation each, one reviewed intent,
 * steps in order (swap → [move to trading] → act), every later step built when it signs.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import type { SwapQuoteOk } from "@senryo/api-client";
import { readAccountSnapshot, readLpVault, readMarketRisk, type TxRequest } from "@senryo/chain";
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL, MAINNET_TOKENS } from "@senryo/config";
import { previewIncrease } from "@senryo/core";
import {
  type ComposedStep,
  composeSteps,
  increaseRequest,
  lpApproveRequest,
  lpDepositRequest,
  moveToTradingSteps,
  type QueryEnv,
  riskViewOf,
  runOperationSteps,
  swapLeg,
} from "@senryo/query";
import { type AddressBook, addressBooks } from "../../../packages/contracts/src/addresses/index.ts";
import type { forkKit } from "./compose-fork-lib.ts";
import { anvil, freshUser } from "./fork.ts";

type Kit = ReturnType<typeof forkKit>;

const ROOT = new URL("../../../", import.meta.url).pathname;
/** Anvil's first dev key: a throwaway deployer on the fork only. */
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const DEPLOYER_MON = "0x3635c9adc5dea00000";
/** LP seed 251 + insurance 50 AUSD (SeedConstants), with room. */
const SEED_AUSD = 400_000_000n;
const USER_MON = "0x1a055690d9db80000";
const POOL_USDT0 = 10_000_000n;
const TRADE_USDC = 10_000_000n;
const LEVERAGE = 2n;
const XAU = 0;
const PLACEHOLDER: TxRequest = { to: "0x0000000000000000000000000000000000000000", data: "0x", action: "approve" };
const MINUTES_PER_HOUR = 60;
/** Metals trade Sun 23:00 – Fri 21:00 UTC with a daily 21:00–23:00 break; keep 15 min for the deploy. */
const CLOSE_MIN = 1_245; // 20:45
const REOPEN_MIN = 1_380; // 23:00
const FRIDAY = 5;
const LOG_TAIL = 400;
const SATURDAY = 6;

function metalsOpenSoon(now = new Date()): boolean {
  const day = now.getUTCDay();
  const minute = now.getUTCHours() * MINUTES_PER_HOUR + now.getUTCMinutes();
  if (day === SATURDAY || (day === FRIDAY && minute >= CLOSE_MIN) || (day === 0 && minute < REOPEN_MIN)) return false;
  return !(minute >= CLOSE_MIN && minute < REOPEN_MIN);
}

function deployStack(fork: string): void {
  for (const script of ["script/Deploy.s.sol", "script/SeedMainnet.s.sol"]) {
    const run = spawnSync(
      "forge",
      [
        "script",
        script,
        "--rpc-url",
        fork,
        "--private-key",
        DEPLOYER_KEY,
        "--broadcast",
        "--slow",
        "--skip-simulation",
      ],
      { cwd: `${ROOT}contracts`, env: { ...process.env, SENRYO_MAINNET_OK: "true" }, encoding: "utf8" },
    );
    if (run.status !== 0) throw new Error(`${script} failed on the fork: ${run.stdout.slice(-LOG_TAIL)}${run.stderr}`);
  }
  const bookPath = `${ROOT}packages/contracts/src/addresses/143.json`;
  (addressBooks as Record<number, AddressBook>)[MAINNET_CHAIN_ID] = JSON.parse(readFileSync(bookPath, "utf8"));
  // The fork's deployment never stays in the worktree.
  rmSync(bookPath, { force: true });
  for (const script of ["Deploy.s.sol", "SeedMainnet.s.sol"]) {
    for (const dir of ["broadcast", "cache"])
      rmSync(`${ROOT}contracts/${dir}/${script}/143`, { recursive: true, force: true });
  }
}

const lazy = (role: ComposedStep["role"], action: ComposedStep["action"], label: string, build: () => TxRequest) => ({
  role,
  action,
  label,
  request: PLACEHOLDER,
  build: async () => build(),
});

export async function payWithAnyAsset(fork: string, env: QueryEnv, kit: Kit) {
  const { check, lend, journalled, mine, userSender, checkOperation, swapQuote } = kit;
  console.log("\n# 3. pay with any asset (the swaps first, then the stack is deployed under them)");
  const pooler = freshUser();
  const trader = freshUser();
  for (const u of [pooler, trader]) await anvil(fork, "anvil_setBalance", [u.address, USER_MON]);
  await lend(MAINNET_EXTERNAL.uniswapV4.poolManager, MAINNET_TOKENS.usdt0, pooler.address, POOL_USDT0);
  await lend(MAINNET_EXTERNAL.uniswapV4.poolManager, MAINNET_TOKENS.usdc, trader.address, TRADE_USDC);
  const [pq, tq]: SwapQuoteOk[] = await Promise.all([
    swapQuote(MAINNET_TOKENS.usdt0, MAINNET_TOKENS.ausd, POOL_USDT0, pooler.address),
    swapQuote(MAINNET_TOKENS.usdc, MAINNET_TOKENS.ausd, TRADE_USDC, trader.address),
  ]);
  if (!pq || !tq) throw new Error("no quotes");
  const deposit = pq.quote.minOut;
  const margin = tq.quote.minOut;
  const notional = margin * LEVERAGE;
  const open = metalsOpenSoon();
  if (!open) console.log("~ metals close before the deploy finishes: the XAU open leg is left out (swap → move only)");
  const poolSteps = composeSteps({
    swap: await swapLeg(env, pooler.address, pq, { approve: "Approve USDT0", swap: "Swap USDT0 → AUSD" }, "swap"),
    act: [
      lazy("act", "approve", "Approve AUSD", () =>
        lpApproveRequest(MAINNET_CHAIN_ID, addressBooks[MAINNET_CHAIN_ID]?.contracts.LpVault?.address ?? "0x", deposit),
      ),
      lazy("act", "lpDeposit", "Deposit", () => lpDepositRequest(MAINNET_CHAIN_ID, deposit, pooler.address)),
    ],
  });
  const openStep = lazy("act", "increase", "Open", () => {
    throw new Error("built after the deploy");
  });
  const tradeSteps = composeSteps({
    swap: await swapLeg(env, trader.address, tq, { approve: "Approve USDC", swap: "Swap USDC → AUSD" }, "swap"),
    move: [
      lazy(
        "move",
        "approve",
        "Approve AUSD",
        () => moveToTradingSteps(MAINNET_CHAIN_ID, "AUSD", margin, 0n)[0]?.request as TxRequest,
      ),
      lazy(
        "move",
        "deposit",
        "Move to trading",
        () => moveToTradingSteps(MAINNET_CHAIN_ID, "AUSD", margin, 0n)[1]?.request as TxRequest,
      ),
    ],
    act: open ? [openStep] : [],
  });
  // The open is priced when it signs (after the deploy), from the market's live preview.
  openStep.build = async () => {
    const m = await readMarketRisk(env.read, MAINNET_CHAIN_ID, XAU, "latest");
    const a = await readAccountSnapshot(env.read, MAINNET_CHAIN_ID, trader.address, "latest");
    const p = previewIncrease({
      market: m.risk,
      book: m.book,
      pv: m.pv,
      account: riskViewOf(a),
      isLong: true,
      notionalUsd6: notional,
    });
    return increaseRequest(MAINNET_CHAIN_ID, XAU, true, notional, p.execPrice18, 1);
  };

  // Both swaps land first; then the stack is deployed while each operation waits at its next step.
  let swapsLeft = 2;
  let release: () => void = () => undefined;
  const swapsDone = new Promise<void>((resolve) => {
    release = resolve;
  });
  const deployed = swapsDone.then(async () => {
    await anvil(fork, "anvil_setBalance", [DEPLOYER, DEPLOYER_MON]);
    await lend(MAINNET_EXTERNAL.uniswapV4.poolManager, MAINNET_TOKENS.ausd, DEPLOYER, SEED_AUSD);
    deployStack(fork);
  });
  const gated =
    (inner: ReturnType<typeof journalled>) =>
    async (...args: Parameters<ReturnType<typeof journalled>>) => {
      const [step] = args;
      if (step.role !== "swap") await deployed;
      try {
        return await inner(...args);
      } finally {
        if (step.role === "swap" && step.action === "aggregatorSwap") {
          swapsLeft -= 1;
          if (swapsLeft === 0) release();
        }
      }
    };
  const poolIntent = {
    kind: "lpDeposit",
    payWith: "USDT0",
    paid: POOL_USDT0.toString(),
    minReceived: deposit.toString(),
    destination: "pool",
  };
  const tradeIntent = {
    kind: "increase",
    marketId: String(XAU),
    side: "long",
    payWith: "USDC",
    paid: TRADE_USDC.toString(),
    minReceived: margin.toString(),
    notionalUsd6: notional.toString(),
  };
  const poolKey = `143:pool-pay-with:${pooler.address}`;
  const tradeKey = `143:ticket-pay-with:${trader.address}`;
  await Promise.all([
    runOperationSteps(poolSteps, poolIntent, gated(journalled(userSender(pooler), poolKey)), {
      read: env.read,
      waitForBlock: mine,
    }),
    runOperationSteps(tradeSteps, tradeIntent, gated(journalled(userSender(trader), tradeKey)), {
      read: env.read,
      waitForBlock: mine,
    }),
  ]);

  const pool = checkOperation("USDT0 → pool", pooler.address, poolKey, poolSteps);
  check(
    pool?.reviewedIntent.payWith === "USDT0" && pool.reviewedIntent.minReceived === deposit.toString(),
    "pool: the reviewed intent names USDT0 and the minimum received",
  );
  const shares = (await readLpVault(env.read, MAINNET_CHAIN_ID, pooler.address)).shares;
  check(shares > 0n, `pool shares minted (${shares})`);
  const trade = checkOperation("USDC → trading → open", trader.address, tradeKey, tradeSteps);
  check(
    tradeSteps.map((s) => s.role).join(" → ") ===
      ["swap", "swap", "move", "move", ...(open ? ["act"] : [])].join(" → "),
    `ticket: ${tradeSteps.map((s) => s.label).join(" → ")}`,
  );
  check(
    trade?.reviewedIntent.payWith === "USDC" && trade.reviewedIntent.minReceived === margin.toString(),
    "ticket: the reviewed intent names USDC and the minimum received",
  );
  const after = await readAccountSnapshot(env.read, MAINNET_CHAIN_ID, trader.address, "latest");
  check(
    open ? after.positionBitmap !== 0 : after.ausd >= margin,
    open ? "the XAU long is open" : `the swapped AUSD is in the trading account (${after.ausd})`,
  );
}
