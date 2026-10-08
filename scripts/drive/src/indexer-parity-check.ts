/**
 * S4 gate (plan "S4 Indexer"): the indexer's history, as the public api serves it, equals the contracts.
 * - every ticket on chain (1…ticketCount): the api has it under its owner with the same band, window, status,
 *   remaining payout and entry print;
 * - every owner: Σ stakes = the Test USD the owner paid the reserve, and Σ returned = the Test USD the reserve paid
 *   the owner plus anything held as owed — Transfer logs read over HyperSync, independent of the indexer;
 * - the caller record (`/stats`) agrees with the calls; each window's call count with the filled tickets.
 * Exits 1 on any mismatch. `API_ORIGIN` (default https://api.senryo.xyz), `ENVIO_API_TOKEN` (HyperSync).
 *
 *   pnpm --filter @senryo/drive exec tsx src/indexer-parity-check.ts
 */
import { callerStatsRoute, callsRoute, createApiClient, windowProofRoute } from "@senryo/api-client";
import { addressOf, createReadClient, dollarTokenOf } from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { bandReserveAbi } from "@senryo/contracts/abis";
import { getAddress, type Hex, toEventSelector } from "viem";
import { sleep } from "./lib.ts";

const CHAIN = TESTNET_CHAIN_ID;
const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
const HYPERSYNC = `https://${CHAIN}.hypersync.xyz/query`;
/** The markets deploy block (packages/contracts/src/addresses/10143.json). */
const FROM_BLOCK = 69_306_230;
const TRANSFER = toEventSelector("Transfer(address,address,uint256)");
const ADDRESS_HEX = 40;
const WORD_HEX = 64;
/** Chain `TICKET_*` → the api's status (an open ticket with a pending close reads "closing"). */
const STATUS = ["none", "committed", "open", "closed", "settled", "refunded"] as const;
const FILLED_FROM = 2;
const HTTP_TOO_MANY = 429;
const RATE_LIMIT_TRIES = 4;
const RATE_LIMIT_FALLBACK_SEC = 10;
const MS = 1000;

const api = createApiClient({ origin: ORIGIN, getToken: () => undefined });
const read = createReadClient(CHAIN);
const reserve = addressOf(CHAIN, "BandReserve");
const dollar = dollarTokenOf(CHAIN);
if (!dollar) throw new Error("no dollar token on this chain");
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};
const word = (address: string) => `0x${address.slice(2).toLowerCase().padStart(WORD_HEX, "0")}`;

/** One HyperSync query; a 429 waits out the token's window (`x-ratelimit-reset`, seconds) and asks again. */
async function hypersync(token: string, query: object): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(HYPERSYNC, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    if (res.ok) return res;
    if (res.status !== HTTP_TOO_MANY || attempt === RATE_LIMIT_TRIES) throw new Error(`HyperSync ${res.status}`);
    const waitSec = Number(res.headers.get("x-ratelimit-reset") ?? RATE_LIMIT_FALLBACK_SEC);
    console.log(`  HyperSync rate-limited — retrying in ${waitSec} s`);
    await sleep(waitSec * MS);
  }
}

interface Flow {
  paidIn: bigint;
  paidOut: bigint;
}

/** Test USD moved between the reserve and each owner, from Transfer logs (HyperSync, paged by `next_block`). */
async function flows(): Promise<Map<string, Flow>> {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) throw new Error("ENVIO_API_TOKEN is required (HyperSync)");
  const out = new Map<string, Flow>();
  const at = (owner: string) => {
    const flow = out.get(owner) ?? { paidIn: 0n, paidOut: 0n };
    out.set(owner, flow);
    return flow;
  };
  let from = FROM_BLOCK;
  for (;;) {
    const res = await hypersync(token, {
      from_block: from,
      logs: [
        { address: [dollar], topics: [[TRANSFER], [word(reserve)]] },
        { address: [dollar], topics: [[TRANSFER], [], [word(reserve)]] },
      ],
      field_selection: { log: ["topic1", "topic2", "data"] },
    });
    const page = (await res.json()) as {
      data: { logs?: { topic1: Hex; topic2: Hex; data: Hex }[] }[];
      archive_height: number;
      next_block: number;
    };
    for (const log of page.data.flatMap((b) => b.logs ?? [])) {
      const src = `0x${log.topic1.slice(-ADDRESS_HEX)}`;
      const dst = `0x${log.topic2.slice(-ADDRESS_HEX)}`;
      const value = BigInt(log.data);
      if (dst === reserve.toLowerCase()) at(src).paidIn += value;
      else at(dst).paidOut += value;
    }
    if (page.next_block > page.archive_height) return out;
    from = page.next_block;
  }
}

async function allCalls(owner: string) {
  const calls = [];
  let before: bigint | undefined;
  for (;;) {
    const page = await api.call(callsRoute, { query: { chainId: CHAIN, owner: getAddress(owner), before } });
    calls.push(...page.calls);
    if (!page.next) return calls;
    before = BigInt(page.next);
  }
}

const count = await read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "ticketCount" });
const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
const tickets = await read.multicall({
  allowFailure: false,
  contracts: ids.map(
    (id) => ({ address: reserve, abi: bandReserveAbi, functionName: "ticketOf", args: [id] }) as const,
  ),
});
const owners = [...new Set(tickets.map((t) => t.owner.toLowerCase()))];
const money = await flows();
const filledPerWindow = new Map<string, number>();
console.log(`indexer parity on ${CHAIN} via ${ORIGIN}: ${ids.length} tickets, ${owners.length} owners\n`);

for (const owner of owners) {
  const calls = await allCalls(owner);
  const byId = new Map(calls.map((c) => [c.ticketId, c]));
  let stakes = 0n;
  let returned = 0n;
  for (const [i, t] of tickets.entries()) {
    if (t.owner.toLowerCase() !== owner) continue;
    const id = BigInt(i + 1);
    const c = byId.get(id);
    if (!c) {
      failures.push(`ticket ${id}: missing from the api`);
      continue;
    }
    const status = t.status === FILLED_FROM && t.closing > 0n ? "closing" : STATUS[t.status];
    check(c.status === status, `ticket ${id}: status ${c.status} ≠ chain ${status}`);
    check(c.band === t.band, `ticket ${id}: band ${c.band} ≠ chain ${t.band}`);
    check(c.windowId.toLowerCase() === t.windowId.toLowerCase(), `ticket ${id}: window differs`);
    check(c.payout === t.payout, `ticket ${id}: payout ${c.payout} ≠ chain ${t.payout}`);
    check((c.entryE8 ?? 0n) === BigInt(t.entryE8), `ticket ${id}: entry ${c.entryE8} ≠ chain ${t.entryE8}`);
    stakes += c.stake;
    returned += c.returned;
    if (t.filledAt > 0) filledPerWindow.set(t.windowId, (filledPerWindow.get(t.windowId) ?? 0) + 1);
  }
  const flow = money.get(owner) ?? { paidIn: 0n, paidOut: 0n };
  const owed = await read.readContract({
    address: reserve,
    abi: bandReserveAbi,
    functionName: "owedOf",
    args: [owner as Hex],
  });
  check(stakes === flow.paidIn, `${owner}: Σ stakes ${stakes} ≠ paid to the reserve ${flow.paidIn}`);
  check(returned === flow.paidOut + owed, `${owner}: Σ returned ${returned} ≠ paid out ${flow.paidOut} + owed ${owed}`);

  const filled = calls.filter((c) => c.fillTx !== null);
  const stats = await api.call(callerStatsRoute, { query: { chainId: CHAIN, owner: getAddress(owner) } });
  const sum = (f: (c: (typeof calls)[number]) => bigint) => filled.reduce((s, c) => s + f(c), 0n);
  check(stats.calls === filled.length, `${owner}: stats.calls ${stats.calls} ≠ filled calls ${filled.length}`);
  check(stats.staked === sum((c) => c.stake), `${owner}: stats.staked ≠ Σ filled stakes`);
  check(stats.returned === sum((c) => c.returned), `${owner}: stats.returned ≠ Σ filled returns`);
  const pnl = calls.reduce((s, c) => s + BigInt(c.pnl ?? 0), 0n);
  check(BigInt(stats.pnl) === pnl, `${owner}: stats.pnl ${stats.pnl} ≠ Σ call pnl ${pnl}`);
  console.log(`  ${owner}  ${calls.length} calls  in ${flow.paidIn}  out ${flow.paidOut}  pnl ${stats.pnl}`);
}

for (const [windowId, filled] of filledPerWindow) {
  const w = await api.call(windowProofRoute, { params: { windowId: windowId as Hex }, query: { chainId: CHAIN } });
  check(w.calls === filled, `window ${windowId}: ${w.calls} calls ≠ ${filled} filled on chain`);
}

console.log(`\n${filledPerWindow.size} windows checked`);
if (failures.length) {
  console.log(`\n✗ ${failures.length} mismatch(es):`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log("✓ the indexer matches the chain");
