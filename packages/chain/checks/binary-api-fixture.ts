/** Disposable test-only deployment. Never imported by service runtime. No external RPC. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { binaryConfigHash } from "@senryo/chain";
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

const STARTUP_ATTEMPTS = 100,
  STARTUP_POLL_MS = 30;
const TX_GAS = 2_000_000n,
  DEPLOY_GAS = 12_000_000n;
const ROUND_SECONDS = 300n,
  CREATE_LEAD = 60n;
export const FIXTURE_FEE = 7n;
const DECIMAL_BASE = 10n,
  MON_DECIMALS = 18n;
export const MON = DECIMAL_BASE ** MON_DECIMALS;
interface Artifact {
  abi: Abi;
  bytecode: { object: Hex };
  deployedBytecode: { object: Hex };
}
const artifact = async (file: string): Promise<Artifact> =>
  JSON.parse(await readFile(new URL(`../../../contracts/out/${file}`, import.meta.url), "utf8"));
export const operation = (s: string) => keccak256(stringToHex(s));
export async function binaryFixture() {
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((r) => socket.close(() => r()));
  const proc = spawn("anvil", ["--host", "127.0.0.1", "--port", String(port), "--chain-id", "10143", "--silent"], {
    stdio: "ignore",
  });
  const stop = async () => {
    if (proc.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      proc.kill("SIGTERM");
    });
  };
  try {
    const url = `http://127.0.0.1:${port}`;
    const chain = defineChain({
      id: BINARY_POLICY.chainId,
      name: "API disposable binary fixture",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [url] } },
    });
    const read = createPublicClient({ chain, transport: http(url), cacheTime: 0, pollingInterval: STARTUP_POLL_MS });
    for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt++) {
      try {
        await read.getChainId();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, STARTUP_POLL_MS));
      }
    }
    const wallet = createWalletClient({ chain, transport: http(url) });
    const [owner, other] = await wallet.getAddresses();
    assert.ok(owner);
    assert.ok(other);
    const send = async (to: Address, data: Hex, value = 0n) => {
      const receipt = await read.waitForTransactionReceipt({
        hash: await wallet.sendTransaction({ account: owner, to, data, value, gas: TX_GAS }),
      });
      assert.equal(receipt.status, "success");
      return receipt;
    };
    const deploy = async (a: Artifact, args: readonly unknown[]) => {
      const receipt = await read.waitForTransactionReceipt({
        hash: await wallet.deployContract({
          account: owner,
          abi: a.abi,
          bytecode: a.bytecode.object,
          args,
          gas: DEPLOY_GAS,
        }),
      });
      assert.equal(receipt.status, "success");
      assert.ok(receipt.contractAddress);
      return receipt.contractAddress;
    };
    const mock = await artifact("FixturePyth.sol/FixturePyth.json");
    await read.request({
      method: "anvil_setCode" as never,
      params: [BINARY_POLICY.receiver, mock.deployedBytecode.object] as never,
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
    const codeHash = async (address: Address) => {
      const code = await read.getCode({ address });
      assert.ok(code);
      return keccak256(code);
    };
    const base: BinaryManifest = {
      version: BINARY_POLICY.version,
      chainId: BINARY_POLICY.chainId,
      environment: "development-fixture",
      environmentId: `fixture:binary-api-${port}`,
      contract,
      oracle,
      receiver: BINARY_POLICY.receiver,
      roundCreator: owner,
      guardian: owner,
      liquidityBeneficiary: owner,
      configHash: operation("placeholder"),
      anchorBlock: anchor.number,
      anchorHash: anchor.hash,
      marketCodeHash: await codeHash(contract),
      oracleCodeHash: await codeHash(oracle),
      receiverCodeHash: await codeHash(BINARY_POLICY.receiver),
    };
    const manifest = { ...base, configHash: binaryConfigHash(base) };
    const environment = {
      environmentId: manifest.environmentId,
      development: true,
      devWorkspace: true,
      consumer: "local-test" as const,
    };
    const call = (functionName: string, args: readonly unknown[], value = 0n) =>
      send(contract, encodeFunctionData({ abi: senryoBinaryV1Abi, functionName, args } as never), value);
    await call("setRiskPaused", [false]);
    const start = ((anchor.timestamp + CREATE_LEAD + ROUND_SECONDS - 1n) / ROUND_SECONDS) * ROUND_SECONDS;
    const created = await call(
      "createRound",
      [BINARY_POLICY.btcFeed, Number(ROUND_SECONDS), start, owner],
      BINARY_POLICY.seedMaxWei,
    );
    const roundId = parseEventLogs({ abi: senryoBinaryV1Abi, logs: created.logs, eventName: "RoundCreated" })[0]?.args
      .roundId;
    assert.ok(roundId);
    const warp = async (timestamp: bigint) => {
      await read.request({ method: "evm_setNextBlockTimestamp" as never, params: [Number(timestamp)] as never });
      await read.request({ method: "evm_mine" as never });
    };
    const proof = (timestamp: bigint, price = 100000000n) => [
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "int64" },
          { type: "uint64" },
          { type: "int32" },
          { type: "uint64" },
          { type: "uint64" },
        ],
        [BINARY_POLICY.btcFeed, price, 1n, BINARY_POLICY.exponent, timestamp, timestamp - 1n],
      ),
    ];
    return { read, manifest, environment, owner, other, call, start, roundId, warp, proof, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
