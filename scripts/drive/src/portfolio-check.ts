/** Wallet → trading → pool → escrow continuity on an isolated testnet fork. Never uses live funds. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  addressOf,
  CONTRACT_ABIS,
  contractCall,
  createReadClient,
  createSender,
  erc20Abi,
  externalCall,
  readContract,
  readPortfolio,
  receiptEvents,
  sendAndFinalize,
  signerFromPrivateKey,
} from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { anvil } from "./fork.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(FORK)) throw new Error("This check only writes to a local fork");
const KEY_BYTES = 32;
const RICH = "0x8ac7230489e80000";
const TRADE_AMOUNT = 10_000_000n;
const POOL_AMOUNT = 20_000_000n;
const HALF = 2n;
const ROUNDING_TOLERANCE = 2n;
const chainId = TESTNET_CHAIN_ID;
const account = signerFromPrivateKey(`0x${randomBytes(KEY_BYTES).toString("hex")}`, "portfolio-check");
const user = account.address;
const read = createReadClient(chainId, { http: [FORK] });
await anvil(FORK, "anvil_setBalance", [user, RICH]);
const sender = createSender({ chainId, account, read, rpc: { http: [FORK] } });
const token = addressOf(chainId, "MockAUSD");
const requestIds: bigint[] = [];
const snapshot = () => readPortfolio(read, chainId, user, async () => ({ ids: requestIds, complete: true }));
const send = async (request: Parameters<typeof sendAndFinalize>[1]) => {
  const result = await sendAndFinalize(sender, request);
  assert.equal(result.final.stage, "finalized");
  assert(result.final.receipt);
  return result.final.receipt;
};
await send(contractCall(chainId, "MockAUSD", "faucet", [], "faucet"));
const initial = await snapshot();
assert.equal(initial.quality, "estimated");
await send(externalCall(token, erc20Abi, "approve", [addressOf(chainId, "SenryoCore"), TRADE_AMOUNT], "approve"));
await send(contractCall(chainId, "SenryoCore", "deposit", [token, TRADE_AMOUNT], "deposit"));
const traded = await snapshot();
assert.equal(
  traded.totalUsd6,
  initial.totalUsd6,
  "wallet-to-trading transfer does not change owned value or apply a risk haircut to the display",
);
assert.equal(traded.components.find((c) => c.name === "Trading account")?.valueUsd6, TRADE_AMOUNT);
const head = await read.getBlock({ blockTag: "finalized" });
const indexedBlock = head.number - 1n;
const lagged = await readPortfolio(read, chainId, user, async () => ({ ids: [], complete: false, indexedBlock }));
assert.equal(lagged.blockNumber, indexedBlock, "all components use the fully indexed snapshot when indexing lags");
assert.equal(lagged.totalUsd6, traded.totalUsd6, "an older coherent snapshot does not double-count a transfer");
assert.equal(lagged.quality, "estimated", "indexer lag alone does not make a fully indexed snapshot partial");
await send(externalCall(token, erc20Abi, "approve", [addressOf(chainId, "LpVault"), POOL_AMOUNT], "approve"));
await send(contractCall(chainId, "LpVault", "deposit", [POOL_AMOUNT, user], "lpDeposit"));
const invested = await snapshot();
const difference = (a: bigint, b: bigint) => (a > b ? a - b : b - a);
const poolValue = invested.components.find((c) => c.name === "Pool investments")?.valueUsd6;
assert(
  poolValue !== undefined && poolValue > 0n && poolValue <= POOL_AMOUNT,
  "shares use the actual conservative redemption value, not the deposit amount",
);
assert(
  difference(invested.totalUsd6, initial.totalUsd6 - POOL_AMOUNT + poolValue) <= ROUNDING_TOLERANCE,
  "moving wallet funds into the pool neither loses nor doubles the actual share valuation",
);
const shares = await readContract(chainId, "LpVault", read).read.balanceOf([user]);
const receipt = await send(contractCall(chainId, "LpVault", "requestRedeem", [shares / HALF, user], "lpRequestRedeem"));
const event = receiptEvents(receipt, "LpVault").find((event) => event.eventName === "RedeemRequested");
assert(event);
requestIds.push(event.args.requestId);
const escrowed = await snapshot();
const currentShareValue = await read.readContract({
  address: addressOf(chainId, "LpVault"),
  abi: CONTRACT_ABIS.LpVault,
  functionName: "convertToAssets",
  args: [shares],
  blockNumber: escrowed.blockNumber,
});
assert(
  difference(escrowed.totalUsd6, initial.totalUsd6 - POOL_AMOUNT + currentShareValue) <= ROUNDING_TOLERANCE,
  "escrowed shares remain in the portfolio",
);
assert(
  difference(escrowed.components.find((c) => c.name === "Pool investments")?.valueUsd6 ?? 0n, currentShareValue) <=
    ROUNDING_TOLERANCE,
);
console.log(
  "Passed: finalized wallet/trading transfer; haircut-free display; pool deposit; active plus escrowed shares; coherent total value.",
);
