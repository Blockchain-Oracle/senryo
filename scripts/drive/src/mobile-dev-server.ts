/** Local native development controller. No secrets; cheats only after verifying a loopback Anvil on Practice. */
import { createServer } from "node:http";
import { addressOf, contractCall, createReadClient, readAccountSnapshot, readMarketRisk } from "@senryo/chain";
import { ENGINE_MARKETS, TESTNET_CHAIN_ID } from "@senryo/config";
import { anvil, DEPLOYER } from "./fork.ts";

const RPC = "http://127.0.0.1:18765";
const PORT = 18766;
const CHAIN = TESTNET_CHAIN_ID;
const MIRROR_ROLE = 70n;
const PRICE_DECIMALS = 18;
const DECIMAL_BASE = 10n;
const START_TRADING_USD6 = 75_000_000n;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_INTERNAL_ERROR = 500;
const MAX_BODY_BYTES = 4096;
const MAX_MOVE_BPS = 100;
const BPS_NUMBER = 10_000;
const BPS = 10_000n;
const REFRESH_MS = 20_000;
const read = createReadClient(CHAIN, { http: [RPC] });
const rich = "0x3635c9adc5dea00000";
const gas = "0x1e8480";
const prepared = new Set<string>();
let snapshot: string | undefined;
let ready = false;
let refreshing = false;
let frozen = false;
const prices = new Map<number, bigint>();

async function assertLocalFork() {
  const version = await anvil<string>(RPC, "web3_clientVersion", []);
  if (!version.toLowerCase().includes("anvil") || (await read.getChainId()) !== CHAIN) {
    throw new Error("Start a local Anvil fork of Monad Practice first. Public networks are refused.");
  }
}

async function transact(from: string, call: { to: string; data: string }) {
  const hash = await anvil<`0x${string}`>(RPC, "eth_sendTransaction", [{ from, to: call.to, data: call.data, gas }]);
  const receipt = await read.waitForTransactionReceipt({ hash, timeout: 15_000 });
  if (receipt.status !== "success") throw new Error(`Local transaction reverted: ${hash}`);
}

async function refresh() {
  if (!ready || refreshing || frozen) return;
  refreshing = true;
  try {
    for (const market of ENGINE_MARKETS) {
      const answer = prices.get(market.id);
      if (answer === undefined) continue;
      await transact(DEPLOYER, contractCall(CHAIN, market.testnetMirror, "pushAnswer", [answer], "pushAnswer"));
      await transact(DEPLOYER, contractCall(CHAIN, "SessionOracle", "observe", [market.id], "observe"));
    }
  } finally {
    refreshing = false;
  }
}

async function initialize() {
  if (ready) return;
  console.log("Preparing local oracle and market state");
  await assertLocalFork();
  snapshot = await anvil<string>(RPC, "evm_snapshot", []);
  await anvil(RPC, "anvil_impersonateAccount", [DEPLOYER]);
  await anvil(RPC, "anvil_setBalance", [DEPLOYER, rich]);
  await transact(DEPLOYER, contractCall(CHAIN, "AccessManager", "grantRole", [MIRROR_ROLE, DEPLOYER, 0], "approve"));
  for (const market of ENGINE_MARKETS) {
    console.log(`Reading local ${market.symbol}`);
    const state = await readMarketRisk(read, CHAIN, market.id);
    prices.set(market.id, state.pv.latest18 / DECIMAL_BASE ** BigInt(PRICE_DECIMALS - market.feedDecimals));
  }
  ready = true;
  await refresh();
  console.log("Local markets ready");
}

async function prepare(address: `0x${string}`) {
  await initialize();
  if (prepared.has(address.toLowerCase())) return;
  console.log("Funding development account");
  await anvil(RPC, "anvil_impersonateAccount", [address]);
  await anvil(RPC, "anvil_setBalance", [address, rich]);
  const before = await readAccountSnapshot(read, CHAIN, address, "latest");
  if (before.ausd === 0n) {
    await transact(address, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"));
    await transact(
      address,
      contractCall(CHAIN, "MockAUSD", "approve", [addressOf(CHAIN, "SenryoCore"), START_TRADING_USD6], "approve"),
    );
    await transact(
      address,
      contractCall(CHAIN, "SenryoCore", "deposit", [addressOf(CHAIN, "MockAUSD"), START_TRADING_USD6], "deposit"),
    );
  }
  await anvil(RPC, "anvil_stopImpersonatingAccount", [address]);
  prepared.add(address.toLowerCase());
  console.log("Development account ready");
}

/** Serialize controls and refreshes: reset must never race an oracle write or funding. */
let queue = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST") {
    response.writeHead(HTTP_METHOD_NOT_ALLOWED).end(JSON.stringify({ error: "POST required" }));
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
      if (chunks.reduce((n, c) => n + c.length, 0) > MAX_BODY_BYTES) throw new Error("Request too large");
    }
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as {
      address?: string;
      marketId?: number;
      bps?: number;
      frozen?: boolean;
    };
    await serial(async () => {
      await assertLocalFork();
      if (request.url === "/prepare" || request.url === "/reset") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(body.address ?? "")) throw new Error("Valid development address required");
        if (request.url === "/reset" && snapshot) {
          if (!(await anvil<boolean>(RPC, "evm_revert", [snapshot]))) throw new Error("Fork reset failed");
          ready = false;
          frozen = false;
          prices.clear();
          prepared.clear();
        }
        await prepare(body.address as `0x${string}`);
      } else if (request.url === "/price") {
        await initialize();
        const marketId = body.marketId ?? 0;
        const bps = body.bps;
        if (!Number.isInteger(bps) || bps === undefined || Math.abs(bps) > MAX_MOVE_BPS)
          throw new Error("Price move must be within 100 bps");
        const current = prices.get(marketId);
        if (current === undefined) throw new Error("Unknown market");
        prices.set(marketId, (current * BigInt(BPS_NUMBER + bps)) / BPS);
        await refresh();
      } else if (request.url === "/freeze") {
        frozen = body.frozen === true;
      } else throw new Error("Unknown development control");
    });
    response.end(JSON.stringify({ ok: true }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    response
      .writeHead(HTTP_INTERNAL_ERROR)
      .end(JSON.stringify({ error: error instanceof Error ? error.message : "Development control failed" }));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Senryo local-fork controller on 127.0.0.1:${PORT}`));

setInterval(() => {
  void serial(refresh).catch((error: unknown) =>
    console.error("Fork refresh:", error instanceof Error ? error.message : error),
  );
}, REFRESH_MS);
