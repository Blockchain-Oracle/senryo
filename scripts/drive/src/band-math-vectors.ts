/**
 * Money check (R3.3, D-300): the device's pricing mirror (`@senryo/core` band-math) prices every vector exactly as
 * `contracts/src/markets/BandMath.sol` did when Foundry wrote it (`BandMathVectors.t.sol` pins the contract to the same
 * file). Offline — no chain, no network. Exits 1 on any difference.
 *
 *   pnpm --filter @senryo/drive exec tsx src/band-math-vectors.ts
 */
import { readFileSync } from "node:fs";
import { type BandShape, probE6 } from "@senryo/core";

const PATH = new URL("../../../packages/core/vectors/band-math.json", import.meta.url);
const KIND: Record<number, BandShape["kind"]> = { 1: "up", 2: "down", 3: "range", 4: "moonshot", 5: "crash" };

interface Vectors {
  k: number;
  kind: number[];
  lowBps: number[];
  highBps: number[];
  spotE8: number[];
  markE8: number[];
  longE8: number[];
  tauSec: number[];
  probE6: number[];
}

// Foundry writes uint256 as JSON numbers; every value here is below 2^53, so Number is exact.
const v = JSON.parse(readFileSync(PATH, "utf8")) as Vectors;
let bad = 0;
for (let i = 0; i < v.probE6.length; i++) {
  const kind = KIND[v.kind[i] ?? 0];
  if (!kind) throw new Error(`vector ${i}: unknown kind ${v.kind[i]}`);
  const band: BandShape = { kind, lowBps: v.lowBps[i] ?? 0, highBps: v.highBps[i] ?? 0 };
  const got = probE6(
    band,
    BigInt(v.k),
    BigInt(v.spotE8[i] ?? 0),
    BigInt(v.markE8[i] ?? 0),
    BigInt(v.longE8[i] ?? 0),
    BigInt(v.tauSec[i] ?? 0),
  );
  const want = BigInt(v.probE6[i] ?? -1);
  if (got !== want) {
    bad++;
    if (bad <= 10) console.error(`vector ${i} (${kind}): contract ${want}, mirror ${got}`);
  }
}
console.log(`${v.probE6.length - bad}/${v.probE6.length} band-math vectors bit-exact`);
process.exit(bad === 0 ? 0 : 1);
