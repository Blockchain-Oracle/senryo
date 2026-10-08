/**
 * Money check (S5): the device's pricing mirror (`@senryo/core` band-math / band-quote) equals the deployed
 * `BandReserve.quoteOpen` bit for bit — probability, price per share and payout — over random bands, stakes, spots
 * (near K and far in the tails) and moments, on real windows with recorded open prints. Menu, σ, terms and the load
 * surcharge are read from the chain, not assumed. Exits 1 on any difference.
 *
 *   pnpm --filter @senryo/drive exec tsx src/band-quote-check.ts [cases]
 */
import { callsRoute, createApiClient, windowProofRoute } from "@senryo/api-client";
import { addressOf, createReadClient, type Hex, seriesIdOf } from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { bandReserveAbi } from "@senryo/contracts/abis";
import { type BandShape, P_ONE, payoutFor, probE6 } from "@senryo/core";

const CHAIN = TESTNET_CHAIN_ID;
const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
/** A wallet from the S4 journey: its calls name real windows with open prints. */
const SAMPLE_OWNER = "0x4749bdC2Ec5E6e0aD6fB43be1fCfe21F1fff851f";
const DEFAULT_CASES = 2_000;
const BATCH = 250;
const KINDS = ["up", "down", "range", "moonshot", "crash"] as const;
const CONTRACT_KIND: Record<number, (typeof KINDS)[number]> = {
  1: "up",
  2: "down",
  3: "range",
  4: "moonshot",
  5: "crash",
};
/** Spots: mostly within ±0.6 % of K, a fifth anywhere within ±30 % (the Φ table's saturated tails). */
const NEAR_BPS = 60;
const FAR_BPS = 3_000;
const FAR_SHARE = 0.2;
const BPS = 10_000;
const MIN_STAKE = 1_000_000;
const MAX_STAKE = 100_000_000;

const api = createApiClient({ origin: ORIGIN, getToken: () => undefined });
const read = createReadClient(CHAIN);
const reserve = addressOf(CHAIN, "BandReserve");
const cases = Number(process.argv[2] ?? DEFAULT_CASES);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

const { calls } = await api.call(callsRoute, { query: { chainId: CHAIN, owner: SAMPLE_OWNER } });
const windowIds = [...new Set(calls.map((c) => c.windowId))];
const windows: Array<{ id: Hex; start: number; expiry: number; k: bigint; seriesId: Hex }> = [];
for (const id of windowIds) {
  const w = await api.call(windowProofRoute, { params: { windowId: id }, query: { chainId: CHAIN } });
  if (!w.open) continue;
  windows.push({
    id,
    start: w.start,
    expiry: w.expiry,
    k: w.open.priceE8,
    seriesId: seriesIdOf(w.symbol, w.cadenceSec),
  });
}
if (windows.length === 0) throw new Error("no window with an open print to quote against");

const params = await read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "params" });
const [halfSpreadE6, maxSurchargeE6, , , , maxExpiryReserved] = params;
const perWindow = new Map<Hex, { menu: BandShape[]; sigmaE8: bigint; surchargeE6: bigint }>();
for (const w of windows) {
  const [menu, sigmaE8, reserved] = await Promise.all([
    read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "menuOf", args: [w.seriesId] }),
    read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "sigmaOf", args: [w.seriesId] }),
    read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "reservedByExpiry", args: [w.expiry] }),
  ]);
  const shapes = menu.map((d) => {
    const kind = CONTRACT_KIND[d.kind];
    if (!kind) throw new Error(`unknown band kind ${d.kind}`);
    return { kind, lowBps: d.lowBps, highBps: d.highBps };
  });
  perWindow.set(w.id, {
    menu: shapes,
    sigmaE8: BigInt(sigmaE8),
    surchargeE6: (BigInt(maxSurchargeE6) * reserved) / BigInt(maxExpiryReserved),
  });
}

const samples = Array.from({ length: cases }, () => {
  const w = windows[Math.floor(Math.random() * windows.length)];
  if (!w) throw new Error("no window");
  const shape = perWindow.get(w.id);
  if (!shape) throw new Error("no menu");
  const band = Math.floor(Math.random() * shape.menu.length);
  const spread = Math.random() < FAR_SHARE ? FAR_BPS : NEAR_BPS;
  const spot = (w.k * BigInt(Math.round(BPS * BPS + rand(-spread, spread) * BPS))) / BigInt(BPS * BPS);
  const at = Math.floor(rand(w.start, w.expiry));
  const stake = BigInt(Math.floor(rand(MIN_STAKE, MAX_STAKE)));
  return { w, band, spot, at, stake };
});

let diffs = 0;
for (let i = 0; i < samples.length; i += BATCH) {
  const batch = samples.slice(i, i + BATCH);
  const results = await read.multicall({
    allowFailure: false,
    contracts: batch.map(
      (s) =>
        ({
          address: reserve,
          abi: bandReserveAbi,
          functionName: "quoteOpen",
          args: [s.w.id, s.band, s.stake, s.spot, s.at],
        }) as const,
    ),
  });
  for (const [j, s] of batch.entries()) {
    const [chainProb, chainPrice, chainPayout] = results[j] as readonly [bigint, bigint, bigint];
    const shape = perWindow.get(s.w.id);
    const band = shape?.menu[s.band];
    if (!shape || !band) throw new Error("no band");
    const prob = probE6(band, s.w.k, s.spot, shape.sigmaE8, BigInt(s.w.expiry - s.at));
    const price = prob + BigInt(halfSpreadE6) + shape.surchargeE6;
    const payout = price < P_ONE ? payoutFor(s.stake, price) : 0n;
    if (prob !== chainProb || price !== chainPrice || payout !== chainPayout) {
      diffs += 1;
      if (diffs <= 10)
        console.log(
          `  ✗ ${band.kind} spot ${s.spot} K ${s.w.k} τ ${s.w.expiry - s.at}: mirror ${prob}/${price}/${payout} chain ${chainProb}/${chainPrice}/${chainPayout}`,
        );
    }
  }
}

console.log(
  `band quote mirror vs BandReserve.quoteOpen on ${CHAIN}: ${samples.length} cases over ${windows.length} windows`,
);
if (diffs) {
  console.log(`✗ ${diffs} differ`);
  process.exit(1);
}
console.log("✓ bit for bit");
