/**
 * S5.2 check: `@senryo/live` against the deployed api — one SSE connection reaches "live", ticks arrive for every
 * crypto market, `/v1/prices/recent` seeds history, the server clock settles, and the stream closes after its last
 * holder lets go. `API_ORIGIN` (default https://api.senryo.xyz), `SECONDS` (default 12).
 *
 *   pnpm --filter @senryo/drive exec tsx src/live-stream-check.ts
 */
import { createApiClient, latestPricesRoute, recentPricesRoute, timeRoute } from "@senryo/api-client";
import { LINGER_MS, Live } from "@senryo/live";
import { sleep } from "./lib.ts";

const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
const DEFAULT_SECONDS = 12;
const SECONDS = Number(process.env.SECONDS ?? DEFAULT_SECONDS);
const E8 = 1e8;
const SHOWN_DECIMALS = 2;
/** A terminal's market loads `/recent` (five minutes at one point a second): far more than the live ticks alone. */
const MIN_SEEDED = 100;
const MS = 1000;
const SYMBOLS = ["BTC", "ETH", "SOL"] as const;
const SETTLE_MS = 500;

const api = createApiClient({ origin: ORIGIN, getToken: () => undefined });
const live = new Live({
  origin: ORIGIN,
  fetch: globalThis.fetch,
  recent: (symbols) => api.call(recentPricesRoute, { query: { symbols: symbols.join(",") } }),
  latest: () => api.call(latestPricesRoute, {}),
  time: async () => (await api.call(timeRoute, {})).t,
  ticket: async () => undefined,
});
const statuses: string[] = [];
live.onStreamStatus(() => statuses.push(live.streamStatus));
const notified = Object.fromEntries(SYMBOLS.map((s) => [s, 0]));
for (const s of SYMBOLS) live.prices.subscribe(s, () => (notified[s] = (notified[s] ?? 0) + 1));

const release = live.stream.acquire();
// As each terminal does for its market (04-pricing R15); a reconnect only reseeds the newest prices.
await Promise.all(SYMBOLS.map((s) => live.loadHistory(s)));
await sleep(SECONDS * MS);
const failures: string[] = [];
for (const s of SYMBOLS) {
  const t = live.prices.latest(s);
  const h = live.prices.history(s);
  console.log(
    `  ${s}  ${notified[s]} frames  last ${t ? (t.priceE8 / E8).toFixed(SHOWN_DECIMALS) : "—"}  history ${h.p.length}`,
  );
  if (!t || live.prices.isStale(s)) failures.push(`${s}: no live price`);
  if ((notified[s] ?? 0) < SECONDS / 2) failures.push(`${s}: only ${notified[s]} frames in ${SECONDS} s`);
  if (h.p.length < MIN_SEEDED) failures.push(`${s}: history ${h.p.length} — loadHistory did not seed`);
}
console.log(`  status ${statuses.join(" → ")}  clock offset ${live.clock.offset} ms`);
if (!statuses.includes("live")) failures.push("never reached live");
release();
await sleep(LINGER_MS + SETTLE_MS);
if (live.streamStatus !== "idle") failures.push(`still ${live.streamStatus} after the linger`);
console.log(`  after release: ${live.streamStatus}`);
if (failures.length) {
  for (const f of failures) console.log(`✗ ${f}`);
  process.exit(1);
}
console.log("✓ live stream ok");
process.exit(0);
