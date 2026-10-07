/** Local native development controller. No secrets; cheats only after verifying a loopback Anvil on Practice. */
import { createServer } from "node:http";
import {
  addressOf,
  contractCall,
  createReadClient,
  readAccountSnapshot,
  readMarketRisk,
  readPerplMarkets,
  readPerplMarketTerms,
} from "@senryo/chain";
import { ENGINE_MARKETS, PERPL_COLLATERAL, PERPL_EXCHANGE, PERPL_MARKETS, TESTNET_CHAIN_ID } from "@senryo/config";
import { encodeAbiParameters, encodeFunctionData, erc20Abi, keccak256, parseAbi, toHex } from "viem";
import { anvil, DEPLOYER } from "./fork.ts";
import { LocalOracleHistory } from "./mobile-dev-history.ts";

const RPC = "http://127.0.0.1:18765";
const PORT = 18766;
const CHAIN = TESTNET_CHAIN_ID;
const MIRROR_ROLE = 70n;
const PRICE_DECIMALS = 18;
const MS_PER_SECOND = 1000;
const DECIMAL_BASE = 10n;
const START_TRADING_USD6 = 75_000_000n;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_INTERNAL_ERROR = 500;
const MAX_BODY_BYTES = 4096;
const MAX_MOVE_BPS = 100;
const BPS_NUMBER = 10_000;
const BPS = 10_000n;
const REFRESH_MS = 20_000;
const LOCAL_READ_TIMEOUT_MS = 30_000;
const read = createReadClient(CHAIN, { http: [RPC], timeoutMs: LOCAL_READ_TIMEOUT_MS });
const rich = "0x3635c9adc5dea00000";
const gas = "0x1e8480";
const prepared = new Set<string>();
let snapshot: string | undefined;
let ready = false;
let refreshing = false;
let frozen = false;
const prices = new Map<number, bigint>();
const history = new LocalOracleHistory();
const perplPrices = new Map<number, bigint>();
const perplPrepared = new Set<number>();
const LOCAL_PRICE_MAX_AGE_SEC = 300n;
const UINT32_MAX = 4_294_967_295n;
const UINT256_BITS = 256n;
const CALENDAR_LAST_WORD_BITS = 160n;
const FULL_WORD = (1n << UINT256_BITS) - 1n;
const CALENDAR_IDS = [0n, 1n];
function uint32(value: bigint): number {
  if (value < 0n || value > UINT32_MAX) throw new Error("Perpl price exceeds uint32");
  return Number(value); // exact: ABI uint32 is safely representable, with no monetary arithmetic in Number.
}
/** Open local weekly sessions for after-hours iteration. MarketCalendar's _week mapping is slot one (forge inspect MarketCalendar storage-layout).
 * Only called after assertLocalFork; fixture storage is discarded on reset. Holidays still follow the contract. */
async function openLocalCalendars() {
  for (const id of CALENDAR_IDS) {
    const base = BigInt(keccak256(encodeAbiParameters([{ type: "uint8" }, { type: "uint256" }], [Number(id), 1n])));
    for (const [offset, bits] of [FULL_WORD, FULL_WORD, (1n << CALENDAR_LAST_WORD_BITS) - 1n].entries()) {
      await anvil(RPC, "anvil_setStorageAt", [
        addressOf(CHAIN, "MarketCalendar"),
        toHex(base + BigInt(offset), { size: 32 }),
        toHex(bits, { size: 32 }),
      ]);
    }
  }
}
const perplAdminAbi = parseAbi([
  "function setPriceMaxAge(uint256 perpId, uint256 maxAgeSec)",
  "function setIgnOracle(uint256 perpId, bool ignore)",
  "function owner() view returns (address)",
  "function updateMarkPricePNSByOwner(uint256 perpId, uint32 markPricePNS)",
]);
let perplOwner: `0x${string}` | undefined;
async function pushPerplPrice(marketId: number, price: bigint) {
  if (!perplOwner) {
    perplOwner = await read.readContract({ address: PERPL_EXCHANGE[CHAIN], abi: perplAdminAbi, functionName: "owner" });
    await anvil(RPC, "anvil_impersonateAccount", [perplOwner]);
    await anvil(RPC, "anvil_setBalance", [perplOwner, rich]);
  }
  if (!perplOwner) throw new Error("Missing local Perpl owner");
  if (!perplPrepared.has(marketId)) {
    // Forked oracle reports stop arriving. Keep this snapshot usable locally; public venues are never altered.
    await transact(perplOwner, {
      to: PERPL_EXCHANGE[CHAIN],
      data: encodeFunctionData({
        abi: perplAdminAbi,
        functionName: "setPriceMaxAge",
        args: [BigInt(marketId), LOCAL_PRICE_MAX_AGE_SEC],
      }),
    });
    await transact(perplOwner, {
      to: PERPL_EXCHANGE[CHAIN],
      data: encodeFunctionData({ abi: perplAdminAbi, functionName: "setIgnOracle", args: [BigInt(marketId), true] }),
    });
    perplPrepared.add(marketId);
  }
  await transact(perplOwner, {
    to: PERPL_EXCHANGE[CHAIN],
    data: encodeFunctionData({
      abi: perplAdminAbi,
      functionName: "updateMarkPricePNSByOwner",
      args: [BigInt(marketId), uint32(price)],
    }),
  });
}

async function assertLocalFork() {
  const version = await anvil<string>(RPC, "web3_clientVersion", []);
  if (!version.toLowerCase().includes("anvil") || (await read.getChainId()) !== CHAIN) {
    throw new Error("Start a local Anvil fork of Monad Practice first. Public networks are refused.");
  }
}

async function transact(from: string, call: { to: string; data: string }) {
  const hash = await anvil<`0x${string}`>(RPC, "eth_sendTransaction", [{ from, to: call.to, data: call.data, gas }]);
  // Mine fixture administration immediately; user-signed sends retain the normal finality pipeline.
  await anvil(RPC, "anvil_mine", [1]);
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
      const confirmed = await readMarketRisk(read, CHAIN, market.id);
      history.record(market.symbol, Number(confirmed.updatedAt), confirmed.pv.latest18);
    }
    for (const [id, price] of perplPrices) await pushPerplPrice(id, price);
  } finally {
    refreshing = false;
  }
}

async function initialize() {
  if (ready) return;
  console.log("Preparing local oracle and market state");
  await assertLocalFork();
  snapshot = await anvil<string>(RPC, "evm_snapshot", []);
  await openLocalCalendars();
  await anvil(RPC, "anvil_impersonateAccount", [DEPLOYER]);
  await anvil(RPC, "anvil_setBalance", [DEPLOYER, rich]);
  await transact(DEPLOYER, contractCall(CHAIN, "AccessManager", "grantRole", [MIRROR_ROLE, DEPLOYER, 0], "approve"));
  for (const market of ENGINE_MARKETS) {
    console.log(`Reading local ${market.symbol}`);
    const state = await readMarketRisk(read, CHAIN, market.id);
    prices.set(market.id, state.pv.latest18 / DECIMAL_BASE ** BigInt(PRICE_DECIMALS - market.feedDecimals));
  }
  for (const id of Object.values(PERPL_MARKETS[CHAIN] ?? {})) {
    const terms = await readPerplMarketTerms(read, CHAIN, id);
    perplPrices.set(id, terms.markPNS);
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
  // Perpl uses Agora's deployment, distinct from our MockAUSD. Credit only through its real faucet on this fork.
  const collateral = await read.readContract({
    address: PERPL_COLLATERAL[CHAIN],
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  if (collateral === 0n)
    await transact(address, {
      to: "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C",
      data: encodeFunctionData({
        abi: parseAbi(["function requestFunds(address recipient)"]),
        functionName: "requestFunds",
        args: [address],
      }),
    });
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
      symbol?: string;
      interval?: number;
      since?: number;
    };
    let payload: object = { ok: true };
    await serial(async () => {
      await assertLocalFork();
      if (request.url === "/prepare" || request.url === "/reset") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(body.address ?? "")) throw new Error("Valid development address required");
        if (request.url === "/reset" && snapshot) {
          if (!(await anvil<boolean>(RPC, "evm_revert", [snapshot]))) throw new Error("Fork reset failed");
          ready = false;
          frozen = false;
          prices.clear();
          perplPrices.clear();
          perplOwner = undefined;
          perplPrepared.clear();
          history.clear();
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
      } else if (request.url === "/perpl-price") {
        await initialize();
        const current = perplPrices.get(body.marketId ?? -1);
        const bps = body.bps;
        if (current === undefined || bps === undefined || !Number.isInteger(bps) || Math.abs(bps) > MAX_MOVE_BPS)
          throw new Error("Invalid local Perpl price move");
        const next = (current * BigInt(BPS_NUMBER + bps)) / BPS;
        await pushPerplPrice(body.marketId ?? -1, next);
        perplPrices.set(body.marketId ?? -1, next);
      } else if (request.url === "/perpl-state") {
        const ids = Object.values(PERPL_MARKETS[CHAIN] ?? {});
        const rows = await readPerplMarkets(read, ids, CHAIN);
        payload = {
          mt: 9,
          d: Object.fromEntries(
            rows.flatMap((row) =>
              row
                ? [[String(row.marketId), { mrk: uint32(row.markPNS), at: { t: row.markTimestamp * MS_PER_SECOND } }]]
                : [],
            ),
          ),
        };
      } else if (request.url === "/freeze") {
        frozen = body.frozen === true;
      } else if (request.url === "/candles") {
        if (!ENGINE_MARKETS.some((m) => m.symbol === body.symbol)) throw new Error("Unknown local market");
        payload = history.candles(body.symbol ?? "", body.interval ?? 0, body.since ?? 0);
      } else throw new Error("Unknown development control");
    });
    response.end(JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    response
      .writeHead(HTTP_INTERNAL_ERROR)
      .end(JSON.stringify({ error: error instanceof Error ? error.message : "Development control failed" }));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Senryo local-fork controller on 127.0.0.1:${PORT}`));

let refreshQueued = false;
setInterval(() => {
  if (refreshQueued) return;
  refreshQueued = true;
  void serial(refresh)
    .catch((error: unknown) => console.error("Fork refresh:", error instanceof Error ? error.message : error))
    .finally(() => {
      refreshQueued = false;
    });
}, REFRESH_MS);
