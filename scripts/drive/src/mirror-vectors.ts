/**
 * Money check (R3.3, R3.19; D-300, D-299): the clients' mirrors compute exactly what the contracts do, against the
 * vectors Foundry writes (`BandMathVectors.t.sol`, `RideMathVectors.t.sol` pin the contracts to the same files):
 * band pricing (`band-math`), ride maths (`ride-math`), the spread curve, and the ride-intent, σ-mark and exit-order
 * EIP-712 digests (`@senryo/chain`). Offline — no chain, no network. Exits 1 on any difference.
 *
 *   pnpm --filter @senryo/drive exec tsx src/mirror-vectors.ts
 */
import { readFileSync } from "node:fs";
import { EXIT_BOOK, EXIT_ORDER_TYPES, rideIntentRequest, sigmaMarkRequest } from "@senryo/chain";
import {
  type BandShape,
  halfSpreadE6,
  probE6,
  rideCapPrice,
  rideEarlyFee,
  rideEquity,
  rideFee,
  rideKeeperFee,
  rideKoPrice,
  rideNotional,
  rideNotionalAt,
  ridePnl,
  rideReserve,
  rideShare,
  rideSize,
} from "@senryo/core";
import { type Address, type Hex, hashTypedData } from "viem";

const DIR = new URL("../../../packages/core/vectors/", import.meta.url);
/** Foundry writes uint256 as bare JSON numbers; past 2^53 `JSON.parse` would round them, so every number is rebuilt
 *  exactly from its source digits (JSON.parse source text access, Node ≥ 21). */
const exact = (_key: string, value: unknown, context?: { source?: string }): unknown =>
  typeof value === "number" && context?.source !== undefined ? BigInt(context.source) : value;
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(name, DIR), "utf8"), exact as (key: string, value: unknown) => unknown) as T;
const KIND: Record<number, BandShape["kind"]> = { 1: "up", 2: "down", 3: "range", 4: "moonshot", 5: "crash" };
const EARLY_FEE_BPS = 20n;
const EARLY_WINDOW_SEC = 15n;
const SPREAD_FLOOR_E6 = 2_500n;
const MIN_PROB_E6 = 10_000n;
const MAX_PROB_E6 = 990_000n;
const MAX_HALF_SPREAD_E6 = 50_000n;
const ACTION_OPEN = 1;

let checked = 0;
let bad = 0;
function same(what: string, i: number, got: bigint, want: bigint | undefined) {
  checked++;
  if (want === undefined || got !== want) {
    bad++;
    if (bad <= 10) console.error(`${what} ${i}: contract ${want}, mirror ${got}`);
  }
}

// ------------------------------------------------------------------------------------------------ band pricing

type Col = Record<string, bigint[]>;
const b = read<Col & { k: bigint }>("band-math.json");
for (let i = 0; i < (b.probE6?.length ?? 0); i++) {
  const kind = KIND[Number(b.kind?.[i] ?? 0n)];
  if (!kind) throw new Error(`band vector ${i}: unknown kind`);
  const at = (c: string) => BigInt(b[c]?.[i] ?? 0);
  const band: BandShape = { kind, lowBps: Number(at("lowBps")), highBps: Number(at("highBps")) };
  same("band", i, probE6(band, BigInt(b.k), at("spotE8"), at("markE8"), at("longE8"), at("tauSec")), b.probE6?.[i]);
}

// ------------------------------------------------------------------------------------------------ rides

const r = read<Col>("ride-math.json");
for (let i = 0; i < (r.size?.length ?? 0); i++) {
  const at = (c: string) => BigInt(r[c]?.[i] ?? 0);
  const isLong = at("isLong") === 1n;
  const [margin, lev, entry, exit, part] = [at("margin"), at("leverageBps"), at("entryE8"), at("exitE8"), at("part")];
  const n = rideNotional(margin, lev);
  const size = rideSize(n, entry);
  const reserve = rideReserve(margin, lev, at("maxProfitBps"), at("maxMoveBps"));
  const pnl = ridePnl(isLong, part, entry, exit);
  const exitN = rideNotionalAt(part, exit);
  same("notional", i, n, r.notional?.[i]);
  same("size", i, size, r.size?.[i]);
  same("reserve", i, reserve, r.reserve?.[i]);
  same("ko", i, size === 0n ? 0n : rideKoPrice(isLong, entry, size, margin), r.koE8?.[i]);
  same("cap", i, size === 0n ? 0n : rideCapPrice(isLong, entry, size, reserve), r.capE8?.[i]);
  same("pnl", i, pnl < 0n ? -pnl : pnl, r.pnlAbs?.[i]);
  same("pnl sign", i, pnl < 0n ? 1n : 0n, r.pnlNeg?.[i]);
  same("equity", i, rideEquity(margin, reserve, pnl), r.equity?.[i]);
  same("fee", i, rideFee(exitN, at("feeBps")), r.fee?.[i]);
  same("early fee", i, rideEarlyFee(exitN, pnl, at("age"), EARLY_FEE_BPS, EARLY_WINDOW_SEC), r.earlyFee?.[i]);
  same("keeper fee", i, rideKeeperFee(margin), r.keeperFee?.[i]);
  same("share", i, size === 0n ? 0n : rideShare(margin, part, size), r.share?.[i]);
  const p = MIN_PROB_E6 + (entry % (MAX_PROB_E6 - MIN_PROB_E6));
  same("spread", i, halfSpreadE6(p, 1n + (margin % MAX_HALF_SPREAD_E6), SPREAD_FLOOR_E6), r.halfSpreadE6?.[i]);
}

// ------------------------------------------------------------------------------------------------ typed data

const t = read<{
  chainId: bigint;
  verifyingContract: Address;
  owner: Address;
  feedId: Hex;
  rideIntent: Hex;
  sigmaMark: Hex;
  exitOrder: Hex;
}>("typed-data.json");
const domain = {
  name: "Senryo Markets",
  version: "1",
  chainId: Number(t.chainId),
  verifyingContract: t.verifyingContract,
};
const ride = rideIntentRequest(domain, {
  action: ACTION_OPEN,
  owner: t.owner,
  marketId: 3,
  isLong: true,
  rideId: 7n,
  margin: 12_345_678n,
  leverageBps: 250_000,
  size: 99n,
  worstPriceE8: 6_123_456_789_012n,
  recipient: t.owner,
  configVersion: 5,
  deadline: 1_800_000_060n,
  nonce: 42n,
  epoch: 1,
});
const mark = sigmaMarkRequest(domain, { feedId: t.feedId, minute: 1_800_000_000, fastE8: 8900n, slowE8: 9100n });
const exit = {
  domain,
  types: EXIT_ORDER_TYPES,
  primaryType: "ExitOrder",
  message: {
    owner: t.owner,
    book: EXIT_BOOK.ride,
    id: 9n,
    takeProfit: 7_000_000_000_000n,
    stopLoss: 5_900_000_000_000n,
    floor: 6_000_000_000_000n,
    trail: 150n,
    deadline: 1_800_000_060n,
    nonce: 77n,
    epoch: 2,
  },
} as const;
for (const [what, got, want] of [
  ["RideIntent", hashTypedData(ride), t.rideIntent],
  ["SigmaMark", hashTypedData(mark), t.sigmaMark],
  ["ExitOrder", hashTypedData(exit), t.exitOrder],
] as const) {
  checked++;
  if (got !== want) {
    bad++;
    console.error(`${what} digest: contract ${want}, mirror ${got}`);
  }
}

console.log(`${checked - bad}/${checked} mirror values bit-exact (band pricing, ride maths, the curve, typed data)`);
process.exit(bad === 0 ? 0 : 1);
