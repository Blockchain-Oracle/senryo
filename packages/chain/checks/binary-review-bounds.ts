import assert from "node:assert/strict";
import {
  BINARY_POLICY,
  BINARY_PUBLIC_DEPLOYMENTS,
  type BinaryEnvironment,
  type BinaryManifest,
  sameBinaryDeployment,
} from "@senryo/config";
import { senryoBinaryV1Abi } from "@senryo/contracts";
import { type Address, encodeFunctionData, type Hex, keccak256, stringToHex, type TransactionReceipt } from "viem";
import { binaryMinimumOutput, buildBinaryTrade } from "../src/binary-calls.ts";
import { readBinaryQuote, readBinaryRound } from "../src/binary-reads.ts";
import type { ReadClient } from "../src/clients.ts";

const BPS = 10_000n;
const DELAY = 14n;
const EXTENDED_DEADLINE = 29n;
const LARGE_MOVES = 3;
const QUOTE_INPUT = 1_000_000_000_000_000_000n;
const op = (s: string) => keccak256(stringToHex(s));

/** Pure identity seam only. No configurable activation registry is introduced or populated. */
export function checkDeploymentIdentity(m: BinaryManifest) {
  const approved = { ...m, environment: "public-testnet" as const, environmentId: "reviewed-test-identity" };
  assert.equal(sameBinaryDeployment(approved, { ...approved }), true);
  for (const key of Object.keys(approved) as (keyof BinaryManifest)[]) {
    const value = approved[key];
    const changed = typeof value === "bigint" ? value + 1n : typeof value === "number" ? value + 1 : `${value}changed`;
    assert.equal(sameBinaryDeployment(approved, { ...approved, [key]: changed } as BinaryManifest), false, key);
  }
  assert.equal(BINARY_PUBLIC_DEPLOYMENTS.length, 0);
}

/** Exercise actual original-contract reserve changes, keeping the user's reviewed request immutable. */
export async function checkReviewBounds(
  read: ReadClient,
  m: BinaryManifest,
  e: BinaryEnvironment,
  roundId: Hex,
  owner: Address,
  otherSend: (data: Hex, value: bigint) => Promise<TransactionReceipt>,
  warp: (timestamp: bigint) => Promise<void>,
) {
  const review = (timestamp: bigint, label: string) => ({
    operationId: op(label),
    now: timestamp,
    reviewedNetworkFeeWei: 0n,
    pendingMonWei: 0n,
    validateScope: () => {},
  });
  let sequence = 0;
  for (const action of ["buy", "sell"] as const) {
    const s = await readBinaryRound(read, m, e, roundId, owner);
    const amount = action === "buy" ? QUOTE_INPUT : s.position.up / 2n;
    const q = await readBinaryQuote(read, s, true, action, amount);
    const min = binaryMinimumOutput(q.quote.output);
    // The boundary is ceil(quoted * 9500 / 10000); one wei lower first exceeds500bps.
    assert.ok(min * BPS >= q.quote.output * (BPS - BigInt(BINARY_POLICY.maxSlippageBps)));
    assert.ok((min - 1n) * BPS < q.quote.output * (BPS - BigInt(BINARY_POLICY.maxSlippageBps)));
    const deadline = q.timestamp + BigInt(BINARY_POLICY.quoteSeconds);
    const req = buildBinaryTrade(read, q, review(q.timestamp, `${action}-bounds`), min, deadline);
    assert.throws(() => buildBinaryTrade(read, q, review(q.timestamp, `${action}-excessive`), min - 1n, deadline));
    const immutable = { data: req.data, value: req.value, meta: { ...req.meta } };
    const move = async (value: bigint) => {
      const block = await read.getBlock();
      const data = encodeFunctionData({
        abi: senryoBinaryV1Abi,
        functionName: "buy",
        args: [
          roundId,
          action === "buy",
          1n,
          block.timestamp + BigInt(BINARY_POLICY.quoteSeconds),
          op(`other-${sequence++}`),
        ],
      });
      assert.equal((await otherSend(data, value)).status, "success");
    };
    await move(BINARY_POLICY.buyMinWei);
    const inside = await readBinaryQuote(read, await readBinaryRound(read, m, e, roundId, owner), true, action, amount);
    assert.notEqual(inside.quote.revision, q.quote.revision);
    assert.ok(inside.quote.output < q.quote.output && inside.quote.output >= min);
    assert.ok(req.validate);
    await req.validate();
    // Actual original calldata remains executable after another account's in-bound reserve change.
    const result = await read.call({ account: owner, to: req.to, data: req.data, value: req.value });
    assert.ok(result.data);
    for (let i = 0; i < LARGE_MOVES; i++) await move(BINARY_POLICY.buyMaxWei);
    const outside = await readBinaryQuote(
      read,
      await readBinaryRound(read, m, e, roundId, owner),
      true,
      action,
      amount,
    );
    assert.ok(outside.quote.output < min);
    await assert.rejects(() => Promise.resolve(req.validate?.()), /below reviewed minimum/);
    await assert.rejects(() => read.call({ account: owner, to: req.to, data: req.data, value: req.value }));
    assert.deepEqual({ data: req.data, value: req.value, meta: { ...req.meta } }, immutable);
  }
  const s = await readBinaryRound(read, m, e, roundId, owner);
  const q = await readBinaryQuote(read, s, true, "buy", QUOTE_INPUT);
  const delayed = review(q.timestamp + DELAY, "delayed");
  assert.throws(() => buildBinaryTrade(read, q, delayed, q.quote.output, q.timestamp + EXTENDED_DEADLINE));
  const req = buildBinaryTrade(read, q, delayed, q.quote.output, q.timestamp + BigInt(BINARY_POLICY.quoteSeconds));
  await warp(q.timestamp + DELAY);
  assert.ok(req.validate);
  await req.validate();
  await warp(q.timestamp + BigInt(BINARY_POLICY.quoteSeconds));
  await assert.rejects(() => Promise.resolve(req.validate?.()), /review expired/);
  // Boundary divisible and indivisible output cases prove the explicit upward minimum rounding.
  assert.equal(binaryMinimumOutput(BPS), BPS - BigInt(BINARY_POLICY.maxSlippageBps));
  assert.equal(binaryMinimumOutput(BPS + 1n), BPS - BigInt(BINARY_POLICY.maxSlippageBps) + 1n);
}
