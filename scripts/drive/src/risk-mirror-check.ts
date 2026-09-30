/**
 * S8.7 differential check of the core risk mirror (money correctness, anvil fork of 10143 only):
 *  1. `previewIncrease` vs `SenryoCore.quote` at the same block — exec price, size, fee, impact exactly equal
 *  2. `freeToTradeAfter` vs `accountRisk` after the fill — never optimistic, within RISK_TOLERANCE_USD6
 *  3. `previewPosition` liquidation price: walk the mirror just outside / inside it (sub-clamp steps, observed) —
 *     `isLiquidatable` must flip across it (long XAU and short XAG, cross-margined)
 *  4. `previewDecrease` vs the `PositionUpdated` fill — realised PnL and fee exactly equal
 * Run: anvil --fork-url https://testnet-rpc.monad.xyz --network monad --port 18765 --block-time 0.5 --mixed-mining
 *        --slots-in-an-epoch 1;  FORK_RPC=http://127.0.0.1:18765 KEEPER_PK_FILE=… pnpm risk-mirror-check
 */
import {
  type AccountSnapshot,
  addressOf,
  CONTRACT_ABIS,
  contractCall,
  createReadClient,
  createSender,
  MemoryJournal,
  readAccountSnapshot,
  readMarketRisk,
  readPositions,
  receiptEvents,
  sendAndFinalize,
  signerFromPrivateKey,
} from "@senryo/chain";
import { type AccountRiskView, previewDecrease, previewIncrease, previewPosition, RISK } from "@senryo/core";
import { requireSecret } from "@senryo/service-common";
import { DEADLINE_SEC, E18_TO_FEED, MS_PER_SECOND, SLIPPAGE_BPS } from "./constants.ts";
import { anvil, freshUser } from "./fork.ts";
import { CHAIN } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const RICH = "0x8ac7230489e80000";
const DEPOSIT_USD6 = 12_000_000n;
const XAU = 0;
const XAG = 1;
/** Oracle walk step, below the 200 bps clamp so every round is accepted. */
const WALK_STEP_BPS = 150n;
/** isLiquidatable is probed this far outside / inside the predicted price. */
const PROBE_BAND_BPS = 20n;
/** Borrow is ceil-rounded per elapsed second, so preview and read differ by a few micro-dollars of accrual. */
const RISK_TOLERANCE_USD6 = 10_000n;
/** Until S8.6 lands per-position budgets: `increase` on a 2-position account estimates ~499k (> the flat 450k). */
const INCREASE_GAS_CAP = 700_000n;
const MINE_WAIT_MS = 600;
/** Hard stop for an oracle walk (a 20 % move at 150 bps per round is ~15 rounds). */
const MAX_WALK_ROUNDS = 40;
const UINT256_BITS = 256n;
const MAX_UINT256 = 2n ** UINT256_BITS - 1n;
/** Trade sizes (usd6): with the 12 AUSD deposit they put both liquidation prices within a few oracle walks. */
const XAU_OPEN_USD6 = 40_000_000n;
const XAU_ADD_USD6 = 10_000_000n;
const XAG_OPEN_USD6 = 20_000_000n;

const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const read = createReadClient(CHAIN, { http: [FORK] });
const user = freshUser();
const keeper = signerFromPrivateKey(requireSecret("KEEPER_PK"), "keeper");
for (const a of [user.address, keeper.address]) await anvil(FORK, "anvil_setBalance", [a, RICH]);
const sender = (account: typeof user) =>
  createSender({ chainId: CHAIN, account, read, rpc: { http: [FORK] }, journal: new MemoryJournal() });
const us = sender(user);
const ks = sender(keeper);
const core = { address: addressOf(CHAIN, "SenryoCore"), abi: CONTRACT_ABIS.SenryoCore } as const;

const riskView = (s: AccountSnapshot): AccountRiskView => ({
  equityLiq: s.equityLiq,
  mm: s.mm,
  freeToTrade: s.freeToTrade,
  atRisk: s.positionBitmap !== 0 || s.holds > 0n || s.envelope > 0n || s.cardDebt > 0n,
});
const snapshot = () => readAccountSnapshot(read, CHAIN, user.address, "latest");
const position = async (id: number) =>
  (await readPositions(read, CHAIN, user.address, (await snapshot()).positionBitmap)).find((p) => p.marketId === id);

await sendAndFinalize(us, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
await sendAndFinalize(us, contractCall(CHAIN, "MockAUSD", "approve", [core.address, DEPOSIT_USD6], "approve"));
await sendAndFinalize(
  us,
  contractCall(CHAIN, "SenryoCore", "deposit", [addressOf(CHAIN, "MockAUSD"), DEPOSIT_USD6], "deposit"),
);

/** Mirror answers are 8-decimal; walk toward `target18` in accepted steps, observing each round. */
async function walkTo(marketId: number, target18: bigint) {
  const mirror = marketId === XAU ? "MirrorXAU" : "MirrorXAG";
  for (let round = 0; round < MAX_WALK_ROUNDS; round += 1) {
    const cur = (await readMarketRisk(read, CHAIN, marketId)).pv.price18;
    const gap = target18 > cur ? target18 - cur : cur - target18;
    if (gap * RISK.BPS <= cur) return; // within 1 bp
    const stepMax = (cur * WALK_STEP_BPS) / RISK.BPS;
    const next = gap <= stepMax ? target18 : target18 > cur ? cur + stepMax : cur - stepMax;
    await sendAndFinalize(ks, contractCall(CHAIN, mirror, "pushAnswer", [next / E18_TO_FEED], "pushAnswer"));
    await sendAndFinalize(ks, contractCall(CHAIN, "SessionOracle", "observe", [marketId], "observe"));
  }
  throw new Error(`walkTo ${marketId}: oracle did not reach ${target18} in ${MAX_WALK_ROUNDS} rounds`);
}

async function increase(marketId: number, isLong: boolean, notionalUsd6: bigint, label: string) {
  const m = await readMarketRisk(read, CHAIN, marketId);
  const acct = await snapshot();
  const held = await position(marketId);
  const preview = previewIncrease({
    market: m.risk,
    book: m.book,
    pv: m.pv,
    account: riskView(acct),
    position: held,
    isLong,
    notionalUsd6,
  });
  const [execPrice, sizeDelta, fee, impact] = await read.readContract({
    ...core,
    functionName: "quote",
    args: [marketId, isLong, notionalUsd6],
    blockTag: "latest",
  });
  record(
    `${label}: preview = quote (exec, size, fee, impact)`,
    preview.execPrice18 === execPrice &&
      preview.sizeDelta === sizeDelta &&
      preview.feeUsd6 === fee &&
      preview.impactBps === impact,
    `exec ${execPrice} size ${sizeDelta} fee ${fee} impact ${impact}`,
  );
  const acceptable = isLong
    ? (execPrice * (RISK.BPS + SLIPPAGE_BPS)) / RISK.BPS
    : (execPrice * (RISK.BPS - SLIPPAGE_BPS)) / RISK.BPS;
  const deadline = BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + DEADLINE_SEC;
  await sendAndFinalize(
    us,
    contractCall(CHAIN, "SenryoCore", "increase", [marketId, isLong, notionalUsd6, acceptable, deadline], "increase", {
      gasCap: INCREASE_GAS_CAP,
    }),
  );
  const after = (await snapshot()).freeToTrade;
  const diff = after - preview.freeToTradeAfter;
  record(
    `${label}: freeToTradeAfter = actual within accrual (1¢)`,
    diff >= -RISK_TOLERANCE_USD6 && diff <= RISK_TOLERANCE_USD6,
    `preview ${preview.freeToTradeAfter} actual ${after}`,
  );
}

async function probeLiquidation(marketId: number, label: string) {
  const m = await readMarketRisk(read, CHAIN, marketId);
  const held = await position(marketId);
  if (!held) throw new Error(`${label}: no position`);
  const start = m.pv.price18;
  const health = previewPosition(m.risk, m.pv, riskView(await snapshot()), held);
  if (health.liqPrice18 === null) return record(`${label}: liquidation price exists`, false);
  const outside = held.isLong ? RISK.BPS + PROBE_BAND_BPS : RISK.BPS - PROBE_BAND_BPS;
  const inside = held.isLong ? RISK.BPS - PROBE_BAND_BPS : RISK.BPS + PROBE_BAND_BPS;
  await walkTo(marketId, (health.liqPrice18 * outside) / RISK.BPS);
  const safe = !(await read.readContract({ ...core, functionName: "isLiquidatable", args: [user.address] }));
  await walkTo(marketId, (health.liqPrice18 * inside) / RISK.BPS);
  const liquidatable = await read.readContract({ ...core, functionName: "isLiquidatable", args: [user.address] });
  record(
    `${label}: isLiquidatable flips across the predicted price (±${PROBE_BAND_BPS} bps)`,
    safe && liquidatable,
    `liq ${health.liqPrice18} (${health.liqDistanceBps} bps from ${start})`,
  );
  await walkTo(marketId, start);
}

/** Increase/decrease on an existing position hit the S8 `_settleFees` snapshot bug before its fix — recorded, not fatal. */
async function attempt(label: string, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    record(label, false, error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
}

await increase(XAU, true, XAU_OPEN_USD6, "XAU long open");
await increase(XAG, false, XAG_OPEN_USD6, "XAG short open");
await probeLiquidation(XAU, "XAU long");
await probeLiquidation(XAG, "XAG short");
await attempt("XAU long increase", () => increase(XAU, true, XAU_ADD_USD6, "XAU long increase"));

// 4 · Partial close of the XAG short: preview at the fill's block vs the PositionUpdated event.
const short = await position(XAG);
if (short)
  await attempt("XAG partial close", async () => {
    const half = short.size / 2n;
    const ready = short.openedBlock + RISK.MIN_HOLD_BLOCKS;
    while ((await read.getBlockNumber()) < ready) await new Promise((r) => setTimeout(r, MINE_WAIT_MS));
    const deadline = BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + DEADLINE_SEC;
    const sent = await sendAndFinalize(
      us,
      contractCall(
        CHAIN,
        "SenryoCore",
        "decrease",
        [XAG, half, short.isLong ? 0n : MAX_UINT256, deadline],
        "decrease",
        {
          gasCap: INCREASE_GAS_CAP,
        },
      ),
    );
    const atFill = await readMarketRisk(read, CHAIN, XAG, sent.receipt.blockNumber);
    const fill = receiptEvents(sent.receipt, "SenryoCore").find((e) => e.eventName === "PositionUpdated");
    const args = fill?.args as { realizedPnl: bigint; fee: bigint; execPrice: bigint } | undefined;
    const preview = previewDecrease(atFill.risk, atFill.pv, short, half, sent.receipt.blockNumber);
    record(
      "XAG partial close: preview = fill (exec, realised PnL, fee)",
      args !== undefined &&
        preview.execPrice18 === args.execPrice &&
        preview.realizedPnlUsd6 === args.realizedPnl &&
        preview.feeUsd6 === args.fee,
      `exec ${args?.execPrice} pnl ${args?.realizedPnl} fee ${args?.fee}`,
    );
  });

const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
