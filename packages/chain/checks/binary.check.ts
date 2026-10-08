/** Disposable original-contract EVM only; no public RPC or shared fork. Run after forge build. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { test } from "node:test";
import { BINARY_POLICY, type BinaryManifest } from "@senryo/config";
import { senryoBinaryV1Abi } from "@senryo/contracts";
import {
  type Abi,
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  parseEventLogs,
  stringToHex,
} from "viem";
import { evaluateTransaction } from "../../account/src/policy/evaluate.ts";
import { emptyUsage } from "../../account/src/policy/types.ts";
import { buildBinaryClaim, buildBinarySettlement, buildBinaryTrade, buildBinaryWithdraw } from "../src/binary-calls.ts";
import {
  binaryConfigHash,
  binaryMaxBuy,
  readBinaryProofFee,
  readBinaryQuote,
  readBinaryRound,
  verifyBinarySource,
} from "../src/binary-reads.ts";
import {
  type BinaryFact,
  binaryReceiptFacts,
  binaryReceiptOutcome,
  rebuildBinaryAccounting,
} from "../src/binary-receipts.ts";
import { type Sender, sendTx } from "../src/send.ts";
import { assertFailedWithdrawalActivity } from "./binary-activity.ts";

const TEST_TIMEOUT_MS = 90000,
  STARTUP_ATTEMPTS = 100,
  STARTUP_POLL_MS = 30;
const TEST_TX_GAS = 2_000_000n,
  TEST_DEPLOY_GAS = 12_000_000n;
const CREATE_LEAD = 60n,
  ALIGNMENT_MINUS_ONE = 299n,
  ROUND_SECONDS = 300n;
const TEN = 10n,
  SEED_EXPONENT = 20n,
  OPENING_PRICE = 100000000n,
  CLOSING_PRICE = 110000000n;
const FIXTURE_FEE = 7n,
  FEE_EXPONENT = 15n,
  MON_DECIMALS = 18n,
  DEADLINE_SECONDS = 12n,
  POLICY_PROOF_PRICE = 100n,
  RESERVE_EXPONENT = 19n;
interface Artifact {
  abi: Abi;
  bytecode: { object: Hex };
  deployedBytecode: { object: Hex };
}
function required<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined);
  return value;
}
const artifact = async (path: string): Promise<Artifact> =>
  JSON.parse(await readFile(new URL(`../../../contracts/out/${path}`, import.meta.url), "utf8"));
const rejectedStepUp = (v: ReturnType<typeof evaluateTransaction>) => {
  assert.equal(v.kind, "reject");
  return v.kind === "reject" && v.stepUp;
};
const op = (s: string) => keccak256(stringToHex(s));
test("binary original-contract reads, builders, policy, receipts and replay in disposable local EVM", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((r) => socket.close(() => r()));
  const proc = spawn("anvil", ["--host", "127.0.0.1", "--port", String(port), "--chain-id", "10143", "--silent"], {
    stdio: "ignore",
  });
  try {
    const chain = defineChain({
      id: BINARY_POLICY.chainId,
      name: "Disposable binary fixture",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [`http://127.0.0.1:${port}`] } },
    });
    const read = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
      cacheTime: 0,
      pollingInterval: STARTUP_POLL_MS,
    });
    for (let i = 0; i < STARTUP_ATTEMPTS; i++) {
      try {
        await read.getChainId();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, STARTUP_POLL_MS));
      }
    }
    const wallet = createWalletClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
    const [owner] = await wallet.getAddresses();
    assert.ok(owner);
    const send = async (to: Address, data: Hex, value = 0n) =>
      read.waitForTransactionReceipt({
        hash: await wallet.sendTransaction({ account: owner, to, data, value, gas: TEST_TX_GAS }),
      });
    const deploy = async (a: Artifact, args: readonly unknown[] = []) => {
      const r = await read.waitForTransactionReceipt({
        hash: await wallet.deployContract({
          account: owner,
          abi: a.abi,
          bytecode: a.bytecode.object,
          args,
          gas: TEST_DEPLOY_GAS,
        }),
      });
      assert.equal(r.status, "success");
      return required(r.contractAddress);
    };
    const fixture = await artifact("FixturePyth.sol/FixturePyth.json");
    await read.request({
      method: "anvil_setCode" as never,
      params: [BINARY_POLICY.receiver, fixture.deployedBytecode.object] as never,
    });
    const oracle = await deploy(await artifact("PythBoundaryOracle.sol/PythBoundaryOracle.json"), [
      BINARY_POLICY.receiver,
    ]);
    const contract = await deploy(await artifact("SenryoBinaryV1.sol/SenryoBinaryV1.json"), [
      oracle,
      owner,
      owner,
      owner,
    ]);
    const anchor = await read.getBlock();
    const manifest: BinaryManifest = {
      version: BINARY_POLICY.version,
      chainId: BINARY_POLICY.chainId,
      environment: "development-fixture",
      environmentId: `fixture:binary-${port}`,
      contract,
      oracle,
      receiver: BINARY_POLICY.receiver,
      roundCreator: owner,
      guardian: owner,
      liquidityBeneficiary: owner,
      configHash: op("temporary"),
      anchorBlock: anchor.number,
      anchorHash: required(anchor.hash),
      marketCodeHash: keccak256(required(await read.getCode({ address: contract }))),
      oracleCodeHash: keccak256(required(await read.getCode({ address: oracle }))),
      receiverCodeHash: keccak256(required(await read.getCode({ address: BINARY_POLICY.receiver }))),
    };
    const m = { ...manifest, configHash: binaryConfigHash(manifest) },
      e = { environmentId: m.environmentId, development: true, devWorkspace: true, consumer: "local-test" as const };
    await verifyBinarySource(read, m, e);
    for (const bad of [
      { ...e, development: false },
      { ...e, consumer: "public-api" as const },
      { ...e, devWorkspace: false },
      { ...e, environmentId: "fixture:wrong" },
    ])
      await assert.rejects(() => verifyBinarySource(read, m, bad));
    await assert.rejects(() => verifyBinarySource(read, { ...m, configHash: op("wrong") }, e));
    await assert.rejects(() => verifyBinarySource(read, { ...m, marketCodeHash: op("wrong") }, e));
    await assert.rejects(() => verifyBinarySource(read, { ...m, anchorHash: op("wrong") }, e));
    await assert.rejects(() => verifyBinarySource(read, { ...m, environment: "public-testnet" }, e));
    const call = async (fn: string, args: readonly unknown[], value = 0n) =>
      send(contract, encodeFunctionData({ abi: senryoBinaryV1Abi, functionName: fn, args } as never), value);
    await call("setRiskPaused", [false]);
    const start = ((anchor.timestamp + CREATE_LEAD + ALIGNMENT_MINUS_ONE) / ROUND_SECONDS) * ROUND_SECONDS;
    const created = await call(
      "createRound",
      [BINARY_POLICY.btcFeed, BINARY_POLICY.durations[0], start, owner],
      TEN ** SEED_EXPONENT,
    );
    const roundId = required(
      parseEventLogs({ abi: senryoBinaryV1Abi, logs: created.logs, eventName: "RoundCreated" })[0],
    ).args.roundId;
    const warp = async (t: bigint) => {
      await read.request({ method: "evm_setNextBlockTimestamp" as never, params: [Number(t)] as never });
      await read.request({ method: "evm_mine" as never });
    };
    const proof = (t: bigint, price: bigint) => [
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "int64" },
          { type: "uint64" },
          { type: "int32" },
          { type: "uint64" },
          { type: "uint64" },
        ],
        [BINARY_POLICY.btcFeed, price, 1n, BINARY_POLICY.exponent, t, t - 1n],
      ),
    ];
    await warp(start);
    assert.equal(await readBinaryProofFee(read, m, e, proof(start, OPENING_PRICE)), FIXTURE_FEE);
    const review = (s: { timestamp: bigint }, label: string) => ({
      operationId: op(label),
      now: s.timestamp,
      reviewedNetworkFeeWei: TEN ** FEE_EXPONENT,
      pendingMonWei: 0n,
      validateScope: () => {},
    });
    let snapshot = await readBinaryRound(read, m, e, roundId, owner);
    let req = await buildBinarySettlement(
      read,
      snapshot,
      review(snapshot, "opening"),
      "recordOpening",
      proof(start, OPENING_PRICE),
    );
    await required(req.validate)();
    await send(req.to, req.data, req.value);
    snapshot = await readBinaryRound(read, m, e, roundId, owner);
    const q = await readBinaryQuote(read, snapshot, true, "buy", TEN ** MON_DECIMALS);
    req = buildBinaryTrade(read, q, review(q, "buy"), q.quote.output, q.timestamp + DEADLINE_SECONDS);
    await assert.rejects(
      () => sendTx({ chainId: 143, account: { address: owner } } as Sender, req),
      /sender\/source mismatch/,
    );
    await assert.rejects(
      () => sendTx({ chainId: BINARY_POLICY.chainId, account: { address: oracle } } as Sender, req),
      /sender\/source mismatch/,
    );
    assert.throws(() => buildBinaryTrade(read, q, review(q, "bad"), 0n, q.timestamp + TEN));
    assert.throws(() => buildBinaryTrade(read, q, review(q, "bad"), q.quote.output, q.timestamp));
    assert.throws(() =>
      buildBinaryTrade(read, q, { ...review(q, "bad"), operationId: "0x1" }, q.quote.output, q.timestamp + TEN),
    );
    const ctx = {
      chainId: BINARY_POLICY.chainId,
      self: owner,
      faceId: "off" as const,
      equityUsd6: () => 0n,
      marketRoomUsd6: () => 0n,
      binary: { manifest: m, environment: e },
    };
    const judge = (data: Hex, value = 0n) =>
      evaluateTransaction(
        { chainId: BINARY_POLICY.chainId, to: contract, data, value, authorizationList: undefined },
        ctx,
        emptyUsage(),
        Date.now(),
      );
    for (const [fn, args, value] of [
      ["buy", [roundId, true, 1n, start + TEN, op("p")], TEN ** MON_DECIMALS],
      ["sell", [roundId, true, 1n, 1n, start + TEN, op("p")], 0n],
      ["claim", [roundId, op("p")], 0n],
      ["withdraw", [1n, op("p")], 0n],
      ["resolve", [roundId, proof(start, POLICY_PROOF_PRICE)], FIXTURE_FEE],
      ["recordOpening", [roundId, proof(start, POLICY_PROOF_PRICE)], FIXTURE_FEE],
      ["voidExpired", [roundId], 0n],
      ["claimLiquidity", [roundId], 0n],
    ] as const) {
      const verdict = judge(encodeFunctionData({ abi: senryoBinaryV1Abi, functionName: fn, args } as never), value);
      assert.equal(verdict.kind, "reject");
      assert.equal(verdict.kind === "reject" && verdict.stepUp, true);
      assert.equal(verdict.kind === "reject" && verdict.reason, "binary-mutation");
    }
    for (const data of [
      "0x12345678",
      `${req.data}00`,
      encodeFunctionData({ abi: senryoBinaryV1Abi, functionName: "setRiskPaused", args: [false] }),
    ] as Hex[])
      assert.equal(rejectedStepUp(judge(data, 1n)), false);
    assert.equal(
      rejectedStepUp(
        judge(encodeFunctionData({ abi: senryoBinaryV1Abi, functionName: "claim", args: [roundId, op("x")] }), 1n),
      ),
      false,
    );
    await required(req.validate)();
    const bought = await send(req.to, req.data, req.value);
    assert.equal(bought.status, "success");
    await assert.rejects(() => Promise.resolve(required(req.validate)()));
    const actorArtifact = await artifact("SenryoBinaryV1.t.sol/WithdrawalActor.json");
    const actor = await deploy(actorArtifact, [contract]);
    const actorCall = async (fn: string, args: readonly unknown[], value = 0n) =>
      send(actor, encodeFunctionData({ abi: actorArtifact.abi, functionName: fn, args }), value);
    const actorBought = await actorCall("buy", [roundId], TEN ** MON_DECIMALS);
    assert.equal(actorBought.status, "success");
    const facts: BinaryFact[] = [...binaryReceiptFacts(bought, m, e)];
    assert.equal(binaryReceiptOutcome(facts, owner, op("buy")).outcome, "bought");
    assert.equal(binaryReceiptFacts({ ...bought, logs: [...bought.logs, ...bought.logs] }, m, e).length, 1);
    snapshot = await readBinaryRound(read, m, e, roundId, owner);
    const sell = await readBinaryQuote(read, snapshot, true, "sell", snapshot.position.up / 2n);
    req = buildBinaryTrade(read, sell, review(sell, "sell"), sell.quote.output, sell.timestamp + DEADLINE_SECONDS);
    await required(req.validate)();
    const sold = await send(req.to, req.data, req.value);
    facts.push(...binaryReceiptFacts(sold, m, e));
    const afterSell = await readBinaryRound(read, m, e, roundId, owner);
    assert.equal(afterSell.creditWei, sell.quote.output);
    assert.equal(binaryMaxBuy(TEN ** RESERVE_EXPONENT, 0n, 1n, TEN ** SEED_EXPONENT), 0n);
    await warp(start + ROUND_SECONDS);
    snapshot = await readBinaryRound(read, m, e, roundId, owner);
    req = await buildBinarySettlement(
      read,
      snapshot,
      review(snapshot, "resolve"),
      "resolve",
      proof(start + ROUND_SECONDS, CLOSING_PRICE),
    );
    await required(req.validate)();
    await send(req.to, req.data, req.value);
    snapshot = await readBinaryRound(read, m, e, roundId, owner);
    req = buildBinaryClaim(read, snapshot, review(snapshot, "claim"));
    await required(req.validate)();
    const claimed = await send(req.to, req.data, req.value);
    facts.push(...binaryReceiptFacts(claimed, m, e));
    snapshot = await readBinaryRound(read, m, e, roundId, owner);
    req = buildBinaryWithdraw(read, snapshot, review(snapshot, "withdraw"), snapshot.creditWei);
    await required(req.validate)();
    const withdrawn = await send(req.to, req.data, req.value);
    facts.push(...binaryReceiptFacts(withdrawn, m, e));
    const actorClaimed = await actorCall("claim", [roundId]);
    assert.equal(actorClaimed.status, "success");
    const rejected = await actorCall("withdraw", [op("failed")]);
    assert.equal(rejected.status, "success");
    const failedFacts = binaryReceiptFacts(rejected, m, e);
    assert.equal(binaryReceiptOutcome(failedFacts, actor, op("failed")).outcome, "withdrawal-failed");
    assertFailedWithdrawalActivity(failedFacts, m, actor, op("failed"));
    const actorCredit = await read.readContract({
      address: contract,
      abi: senryoBinaryV1Abi,
      functionName: "creditOf",
      args: [actor],
    });
    assert.ok(actorCredit > 0n);
    await actorCall("configure", [false, false]);
    const reused = await actorCall("withdraw", [op("failed")]);
    assert.equal(reused.status, "reverted");
    const retried = await actorCall("withdraw", [op("retry")]);
    assert.equal(retried.status, "success");
    assert.equal(binaryReceiptOutcome(binaryReceiptFacts(retried, m, e), actor, op("retry")).outcome, "paid");
    const actorFacts = [
      ...binaryReceiptFacts(actorBought, m, e),
      ...binaryReceiptFacts(actorClaimed, m, e),
      ...failedFacts,
      ...binaryReceiptFacts(retried, m, e),
    ];
    assert.equal(rebuildBinaryAccounting(actorFacts, actor).creditWei, 0n);
    assert.equal(rebuildBinaryAccounting(actorFacts, actor).transferredWei, actorCredit);
    assert.doesNotThrow(() => JSON.stringify(facts));
    const accounting = rebuildBinaryAccounting(facts, owner);
    assert.equal(accounting.creditWei, 0n);
    assert.equal(accounting.transferredWei, snapshot.creditWei);
    assert.deepEqual(rebuildBinaryAccounting([...facts, ...facts], owner), accounting);
    const partialBasis = rebuildBinaryAccounting(facts.slice(0, 2), owner);
    const positionBasis = required(Object.values(partialBasis.positions)[0]).up;
    const soldBasis = (q.quote.input * sell.quote.input) / q.quote.output;
    assert.equal(positionBasis.costWei, q.quote.input - soldBasis);
    assert.equal(positionBasis.realizedWei, sell.quote.output - soldBasis);
    const rollback = rebuildBinaryAccounting(facts.slice(0, -1), owner);
    assert.equal(rollback.creditWei, snapshot.creditWei);
    assert.equal(rollback.transferredWei, 0n);
    assert.equal(binaryReceiptOutcome(binaryReceiptFacts(withdrawn, m, e), owner, op("withdraw")).outcome, "paid");
    console.warn(
      "Disposable fixture gasUsed (not public gas):",
      JSON.stringify({
        buy: String(bought.gasUsed),
        sell: String(sold.gasUsed),
        claim: String(claimed.gasUsed),
        withdraw: String(withdrawn.gasUsed),
        withdrawFailed: String(rejected.gasUsed),
      }),
    );
  } finally {
    proc.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (proc.exitCode !== null) resolve();
      else proc.once("exit", () => resolve());
    });
  }
});
