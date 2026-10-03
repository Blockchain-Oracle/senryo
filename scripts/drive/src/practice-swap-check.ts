/**
 * Practice swap live check (D-252, flow book B6 (P)) on Monad testnet: the test account swaps AUSD → USDC and then
 * USDC → AUSD at par through `PracticeSwap`, with the same builder the app's ticket signs (`@senryo/query`
 * `practiceSwapLeg` → `@senryo/chain` `preparePracticeSwap`: exact approval when short, then the swap). When the
 * account's MON can't cover a step's budget, its network fee is sponsored the way Practice does it: a signed `TopUp`
 * → `POST /v1/starter/topup` → the sponsor's `StarterDrip.topUp`, followed to finalized (an account that never made
 * the P$100 claim makes it first, as every Practice account does). Prints every transaction, the
 * gas each was sent with, and the balances before and after; exits non-zero unless both legs land at exactly par.
 *
 *   TRADER_PK_FILE=~/.config/senryo/testnet-trader.key pnpm --filter @senryo/drive practice-swap-check [amountUsd6]
 */
import { signStarterClaim, signStarterTopUp } from "@senryo/account";
import { createApiClient, starterClaimRoute, starterRelayRoute, starterTopUpRoute } from "@senryo/api-client";
import { addressOf, readContract, readTokenBalances, type Sender } from "@senryo/chain";
import { API_ORIGIN, FUNDING_SETTLE_BLOCKS, NATIVE_TOKEN } from "@senryo/config";
import { type Address, formatUnits, isTerminalStage } from "@senryo/core";
import { gasBudgetFor, practiceSwapLeg, type QueryEnv } from "@senryo/query";
import { DEC, WAIT } from "./constants.ts";
import { CHAIN, type Drive, openDrive, sleep } from "./lib.ts";

/** P$5 each way unless an amount (usd6) is given. */
const DEFAULT_AMOUNT_USD6 = 5_000_000n;
const RELAY_POLLS = 60;
const SHOWN = 6;
const LABEL_COL = 7;

const api = createApiClient({ origin: process.env.API_URL ?? API_ORIGIN });

interface Book {
  ausd: Address;
  usdc: Address;
  swap: Address;
}

type Balances = Record<"ausd" | "usdc" | "swapAusd" | "swapUsdc" | "mon", bigint>;

async function balances(drive: Drive, owner: Address, book: Book): Promise<Balances> {
  const [ausd, usdc, mon] = await readTokenBalances(drive.read, owner, [book.ausd, book.usdc, NATIVE_TOKEN]);
  const [swapAusd, swapUsdc] = await readTokenBalances(drive.read, book.swap, [book.ausd, book.usdc]);
  const all = { ausd, usdc, swapAusd, swapUsdc, mon };
  for (const [k, v] of Object.entries(all)) if (v === undefined) throw new Error(`balance read failed: ${k}`);
  return all as Balances;
}

function show(label: string, b: Balances) {
  const usd = (v: bigint) => formatUnits(v, DEC.usd6, SHOWN);
  console.log(
    `  ${label.padEnd(LABEL_COL)} account ${usd(b.ausd)} AUSD · ${usd(b.usdc)} USDC · ${formatUnits(b.mon, DEC.e18, SHOWN)} MON` +
      ` | float ${usd(b.swapAusd)} AUSD · ${usd(b.swapUsdc)} USDC`,
  );
}

type Relay = Awaited<ReturnType<typeof api.call<typeof starterRelayRoute>>>;

/** Follows a sponsor relay to finalized, then waits until the funded account may spend (Monad: 3 blocks). */
async function follow(drive: Drive, first: Relay, what: string) {
  let relay = first;
  for (let i = 0; i < RELAY_POLLS && !isTerminalStage(relay.stage); i += 1) {
    await sleep(WAIT.pollMs);
    relay = await api.call(starterRelayRoute, { params: { relayId: relay.relayId } });
  }
  if (relay.stage !== "finalized" || relay.blockNumber === null) throw new Error(`${what} ended at ${relay.stage}`);
  console.log(`  ✓ ${what}: ${formatUnits(relay.nativeWei, DEC.e18, SHOWN)} MON (${relay.txHash})`);
  const spendable = relay.blockNumber + FUNDING_SETTLE_BLOCKS;
  for (let i = 0; i < RELAY_POLLS && (await drive.read.getBlockNumber({ cacheTime: 0 })) < spendable; i += 1) {
    await sleep(WAIT.pollMs);
  }
}

/** A Practice account starts with the P$100 claim (A2 step 3); fee top-ups are only for accounts that made it. */
async function ensureClaimed(drive: Drive, sender: Sender) {
  const drip = readContract(CHAIN, "StarterDrip", drive.read);
  if (await drip.read.claimed([sender.account.address], { blockTag: "latest" })) return;
  const signed = await signStarterClaim(sender.account, CHAIN, Date.now());
  await follow(drive, await api.call(starterClaimRoute, { body: signed }), "practice money claimed");
}

/** Practice sponsorship (D-171): when the balance can't cover `needWei`, the sponsor tops it up through the API. */
async function sponsorIfShort(drive: Drive, sender: Sender, needWei: bigint) {
  const owner = sender.account.address;
  const have = await drive.read.getBalance({ address: owner, blockTag: "latest" });
  if (have >= needWei) return;
  const signed = await signStarterTopUp(sender.account, CHAIN, needWei, Date.now());
  await follow(drive, await api.call(starterTopUpRoute, { body: signed }), "network fee sponsored");
}

async function leg(
  drive: Drive,
  sender: Sender,
  env: QueryEnv,
  tokenIn: Address,
  symbols: [string, string],
  amount: bigint,
) {
  const owner = sender.account.address;
  const steps = await practiceSwapLeg(
    env,
    owner,
    tokenIn,
    amount,
    { approve: `Approve ${symbols[0]}`, swap: `Swap ${symbols[0]} → ${symbols[1]}` },
    "swap",
  );
  for (const step of steps) {
    const budget = await gasBudgetFor(drive.read, owner, step.request);
    await sponsorIfShort(drive, sender, budget.needWei);
    await drive.send(sender, step.label, step.request);
  }
}

async function main() {
  const amount = process.argv[2] ? BigInt(process.argv[2]) : DEFAULT_AMOUNT_USD6;
  const drive = await openDrive();
  try {
    const sender = drive.sender("TRADER");
    const owner = sender.account.address;
    const book: Book = {
      ausd: addressOf(CHAIN, "MockAUSD"),
      usdc: addressOf(CHAIN, "MockUSDC"),
      swap: addressOf(CHAIN, "PracticeSwap"),
    };
    // The leg builder reads through `env.read` on `env.chainId` only.
    const env = { chainId: CHAIN, read: drive.read } as QueryEnv;
    console.log(`practice swap ${book.swap} · account ${owner} · ${formatUnits(amount, DEC.usd6, SHOWN)} each way`);
    const before = await balances(drive, owner, book);
    show("before", before);
    if (before.ausd < amount) throw new Error("the test account's wallet holds too little AUSD");
    await ensureClaimed(drive, sender);

    await leg(drive, sender, env, book.ausd, ["AUSD", "USDC"], amount);
    const mid = await balances(drive, owner, book);
    show("after 1", mid);
    await leg(drive, sender, env, book.usdc, ["USDC", "AUSD"], amount);
    const after = await balances(drive, owner, book);
    show("after 2", after);

    const checks: Array<[string, boolean]> = [
      ["AUSD → USDC paid exactly", before.ausd - mid.ausd === amount],
      ["AUSD → USDC received at par", mid.usdc - before.usdc === amount],
      ["USDC → AUSD paid exactly", mid.usdc - after.usdc === amount],
      ["USDC → AUSD received at par", after.ausd - mid.ausd === amount],
      [
        "float total unchanged",
        before.swapAusd + before.swapUsdc === after.swapAusd + after.swapUsdc &&
          before.swapAusd + before.swapUsdc === mid.swapAusd + mid.swapUsdc,
      ],
    ];
    for (const [name, ok] of checks) console.log(`  ${ok ? "✓" : "✗"} ${name}`);
    return checks.every(([, ok]) => ok);
  } finally {
    await drive.close();
  }
}

process.exit((await main()) ? 0 : 1);
