/** biome-ignore-all lint/style/noMagicNumbers: Exact numeric lifecycle fixtures and boundary assertions. */
/** Isolated throwaway accounts on the already-running host-local Anvil. Never resets the Simulator fixture. */
import assert from "node:assert/strict";
import {
  addressOf,
  contractCall,
  createReadClient,
  createSender,
  erc20Abi,
  MemoryJournal,
  readAccountSnapshot,
  readTokenBalances,
  type TxRequest,
} from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { type MoneyAsset, moveSteps, practiceSwapLeg, type QueryEnv, sendTracked } from "@senryo/query";
import { anvil, freshUser } from "./fork.ts";

const RPC = "http://127.0.0.1:18765";
assert.equal(new URL(RPC).hostname, "127.0.0.1");
assert.match(await anvil<string>(RPC, "web3_clientVersion", []), /anvil/i);
const read = createReadClient(TESTNET_CHAIN_ID, { http: [RPC] });
assert.equal(await read.getChainId(), TESTNET_CHAIN_ID);
const account = freshUser();
const recipient = freshUser().address;
await anvil(RPC, "anvil_setBalance", [account.address, "0x56bc75e2d63100000"]);
const sender = createSender({
  chainId: TESTNET_CHAIN_ID,
  account,
  read,
  rpc: { http: [RPC] },
  journal: new MemoryJournal(),
});
const env = { read, chainId: TESTNET_CHAIN_ID } as QueryEnv;
const ausd = addressOf(TESTNET_CHAIN_ID, "MockAUSD");
const usdc = addressOf(TESTNET_CHAIN_ID, "MockUSDC");
async function run(request: TxRequest, label: string) {
  const result = await sendTracked(sender, request, () => undefined);
  assert.equal(result.final?.stage, "finalized", label);
  console.log(`${label}: finalized ${result.hash}`);
}
await run(contractCall(TESTNET_CHAIN_ID, "MockAUSD", "faucet", [], "faucet"), "local faucet");
const before = (await readTokenBalances(read, account.address, [ausd]))[0] ?? 0n;
assert.ok(before > 20_000_000n);
await run(
  contractCall(
    TESTNET_CHAIN_ID,
    "MockAUSD",
    "approve",
    [addressOf(TESTNET_CHAIN_ID, "SenryoCore"), 20_000_000n],
    "approve",
  ),
  "approve trading deposit",
);
await run(contractCall(TESTNET_CHAIN_ID, "SenryoCore", "deposit", [ausd, 20_000_000n], "deposit"), "trading deposit");
let wallet = (await readTokenBalances(read, account.address, [ausd]))[0] ?? 0n;
const asset = {
  address: ausd,
  key: ausd.toLowerCase(),
  native: false,
  symbol: "AUSD",
  decimals: 6,
  wallet,
  collateral: "AUSD",
  trading: 20_000_000n,
  tradingFree: 20_000_000n,
} as MoneyAsset;
const sendAmount = wallet + 1_000_000n;
const steps = moveSteps(TESTNET_CHAIN_ID, asset, sendAmount, recipient, 0, "send");
assert.deepEqual(
  steps.map((s) => s.action),
  ["withdraw", "erc20Transfer"],
);
for (const step of steps) await run(step.request, step.label);
assert.equal(
  (await readTokenBalances(read, recipient, [ausd]))[0],
  sendAmount,
  "recipient gets wallet plus free trading part exactly",
);
const afterSend = await readAccountSnapshot(read, TESTNET_CHAIN_ID, account.address, "latest");
assert.equal(afterSend.ausd, 19_000_000n);
asset.wallet = 0n;
for (const step of moveSteps(TESTNET_CHAIN_ID, asset, 5_000_000n, account.address, 0, "withdraw"))
  await run(step.request, "withdraw to wallet");
wallet = (await readTokenBalances(read, account.address, [ausd]))[0] ?? 0n;
assert.equal(wallet, 5_000_000n);
for (const token of [ausd, usdc]) {
  const leg = await practiceSwapLeg(
    env,
    account.address,
    token,
    1_000_000n,
    { approve: "Approve", swap: "Swap" },
    "swap",
  );
  for (const step of leg) await run(step.request, token === ausd ? "AUSD to USDC" : "USDC to AUSD");
}
const final = await readTokenBalances(read, account.address, [ausd, usdc]);
assert.deepEqual(final, [wallet, 0n], "both Practice swap legs settle exactly at par");
assert.equal(
  await read.readContract({ address: ausd, abi: erc20Abi, functionName: "balanceOf", args: [recipient] }),
  sendAmount,
);
console.log(
  "Passed: localhost-only actual Send wallet+pull, Withdraw trading→wallet, AUSD↔USDC exact par; no reset or public broadcast.",
);
