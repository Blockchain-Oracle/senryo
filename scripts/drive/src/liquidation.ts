/**
 * S3.8 testnet drive: deposit (mock AUSD) → XAU long → MirrorAggregator price steps → the keeper service liquidates.
 * Run the keeper first (MIRROR relay off so it doesn't fight the steps), then:
 *   TRADER_PK_FILE=~/.config/senryo/testnet-trader.key KEEPER_URL=http://127.0.0.1:3002 pnpm --filter @senryo/drive liquidation
 * The trader holds MIRROR_ROLE on testnet (D-115) to move the price; each step stays under the oracle clamp (200 bps)
 * and is accepted by the keeper's `observe` poke. Testnet only; every tx is printed with its explorer link.
 */
import {
  addressOf,
  contractCall,
  readAccountSnapshot,
  readContract,
  readLiquidatable,
  readOracleStates,
  readOracles,
  SimulationRevertedError,
} from "@senryo/chain";
import { formatUnits } from "@senryo/core";
import {
  BPS,
  DEADLINE_SEC,
  DEC,
  DEFAULT_DEPOSIT_USD6,
  DEFAULT_KEEPER_URL,
  DEFAULT_LEVERAGE_BPS,
  DEFAULT_STEP_BPS,
  E18_TO_FEED,
  MAX_OPEN_TRIES,
  MAX_STEPS,
  MS_PER_SECOND,
  RETRY_SHRINK_BPS,
  SHOWN_DIGITS,
  SLIPPAGE_BPS,
  WAIT,
  XAU_MARKET,
} from "./constants.ts";
import { CHAIN, openDrive, waitUntil } from "./lib.ts";

const XAU = XAU_MARKET;
const DEPOSIT_USD6 = BigInt(process.env.DEPOSIT_USD6 ?? DEFAULT_DEPOSIT_USD6);
const LEVERAGE_BPS = BigInt(process.env.LEVERAGE_BPS ?? DEFAULT_LEVERAGE_BPS);
const STEP_BPS = BigInt(process.env.STEP_BPS ?? DEFAULT_STEP_BPS);
const KEEPER_URL = process.env.KEEPER_URL ?? DEFAULT_KEEPER_URL;
const SELF_OBSERVE = process.env.SELF_OBSERVE === "1";
const E10 = E18_TO_FEED;
const SHOWN = SHOWN_DIGITS;

const drive = await openDrive();
const trader = drive.sender("TRADER");
const user = trader.account.address;
const core = readContract(CHAIN, "SenryoCore", drive.read);
const ausd = readContract(CHAIN, "MockAUSD", drive.read);
const coreAddress = addressOf(CHAIN, "SenryoCore");
const startMon = await drive.read.getBalance({ address: user });
console.log(`trader ${user} · ${formatUnits(startMon, DEC.e18, SHOWN)} MON`);

const [oracle] = await readOracles(drive.read, CHAIN, [XAU]);
if (oracle?.status !== "OPEN") throw new Error(`XAU is ${oracle?.status}; the drive needs an OPEN market`);
console.log(`XAU oracle ${formatUnits(oracle.price18, DEC.e18, SHOWN)} (${oracle.status})`);

let snap = await readAccountSnapshot(drive.read, CHAIN, user, "finalized");
if (snap.positionBitmap === 0) {
  if ((await ausd.read.balanceOf([user])) < DEPOSIT_USD6 && snap.ausd < DEPOSIT_USD6) {
    await drive.send(trader, "MockAUSD.faucet", contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
  }
  if (snap.ausd < DEPOSIT_USD6) {
    if ((await ausd.read.allowance([user, coreAddress])) < DEPOSIT_USD6) {
      await drive.send(
        trader,
        "MockAUSD.approve(core)",
        contractCall(CHAIN, "MockAUSD", "approve", [coreAddress, DEPOSIT_USD6], "approve"),
      );
    }
    const ausdToken = addressOf(CHAIN, "MockAUSD");
    await drive.send(
      trader,
      "SenryoCore.deposit",
      contractCall(CHAIN, "SenryoCore", "deposit", [ausdToken, DEPOSIT_USD6], "deposit"),
    );
  }
  let notional = (DEPOSIT_USD6 * LEVERAGE_BPS) / BPS;
  for (let attempt = 1; ; attempt += 1) {
    const [execPrice] = await core.read.quote([XAU, true, notional]);
    const acceptable = (execPrice * (BPS + SLIPPAGE_BPS)) / BPS;
    const deadline = BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + DEADLINE_SEC;
    try {
      await drive.send(
        trader,
        `increase XAU long $${formatUnits(notional, DEC.usd6, SHOWN)}`,
        contractCall(CHAIN, "SenryoCore", "increase", [XAU, true, notional, acceptable, deadline], "increase"),
      );
      break;
    } catch (error) {
      if (!(error instanceof SimulationRevertedError) || attempt >= MAX_OPEN_TRIES) throw error;
      console.log(`  · open refused (${error.revert?.message}); shrinking`);
      notional = (notional * RETRY_SHRINK_BPS) / BPS;
    }
  }
  snap = await readAccountSnapshot(drive.read, CHAIN, user, "finalized");
}
console.log(
  `position open · equityLiq ${formatUnits(snap.equityLiq, DEC.usd6, SHOWN)} · MM ${formatUnits(snap.mm, DEC.usd6, SHOWN)}`,
);

for (let step = 1; step <= MAX_STEPS; step += 1) {
  if ((await readLiquidatable(drive.read, CHAIN, [user])).get(user)) break;
  const [state] = await readOracleStates(drive.read, CHAIN, [XAU]);
  if (!state) throw new Error("no oracle state");
  const next18 = (state.lastPrice18 * (BPS - STEP_BPS)) / BPS;
  const answer8 = next18 / E10;
  await drive.send(
    trader,
    `price step ${step}: ${formatUnits(answer8, DEC.feed8, SHOWN)}`,
    contractCall(CHAIN, "MirrorXAU", "pushAnswer", [answer8], "pushAnswer"),
  );
  const accepted = SELF_OBSERVE
    ? undefined
    : await waitUntil(
        async () => {
          const [s] = await readOracleStates(drive.read, CHAIN, [XAU]);
          return s && s.lastPrice18 === answer8 * E10 ? true : undefined;
        },
        WAIT.observeMs,
        WAIT.pollMs,
      );
  if (!accepted) {
    console.log("  · keeper did not observe in time; observing from the drive");
    await drive.send(
      trader,
      "SessionOracle.observe",
      contractCall(CHAIN, "SessionOracle", "observe", [XAU], "observe"),
    );
  }
}

console.log("liquidatable — waiting for the keeper…");
const liquidated = await waitUntil(
  async () => {
    const s = await readAccountSnapshot(drive.read, CHAIN, user, "finalized");
    return s.positionBitmap === 0 ? s : undefined;
  },
  WAIT.liquidationMs,
  WAIT.pollMs,
);
const status = (await fetch(`${KEEPER_URL}/v1/keeper/status`)
  .then((r) => r.json())
  .catch(() => null)) as { recent?: Array<{ job: string; subject: string; tx: string; stage: string }> } | null;
const keeperTx = status?.recent?.find((a) => a.job === "liquidate" && a.subject.toLowerCase() === user.toLowerCase());
const endMon = await drive.read.getBalance({ address: user });
console.log(
  JSON.stringify(
    {
      result: liquidated ? "liquidated" : "not-liquidated",
      keeperLiquidation: keeperTx ?? null,
      after: liquidated && {
        equityLiq: formatUnits(liquidated.equityLiq, DEC.usd6, SHOWN),
        freeToTrade: formatUnits(liquidated.freeToTrade, DEC.usd6, SHOWN),
        ausd: formatUnits(liquidated.ausd, DEC.usd6, SHOWN),
      },
      traderMonSpent: formatUnits(startMon - endMon, DEC.e18, SHOWN),
      txs: drive.txs,
    },
    null,
    2,
  ),
);
await drive.close();
process.exit(liquidated ? 0 : 1);
