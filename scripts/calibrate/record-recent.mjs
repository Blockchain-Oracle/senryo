#!/usr/bin/env node
// R3.2 sub-minute data (D-300): Pyth's own per-second prices, recorded from Senryo's `/v1/prices/recent` (the last
// 300 s at 1 Hz) polled every four minutes, so the record has no holes. Binance's 1-second trades are no proxy below a
// minute (a quiet market prints no trade for seconds; Pyth's aggregate keeps moving), and bulk Pyth history shares the
// production key's quota.
//
//   node scripts/calibrate/record-recent.mjs <out-dir> <hours> [api-origin]
//
// Appends `t,price` rows (t in seconds, price × 1e-8) to `pyth-1s/<SYMBOL>.csv` in <out-dir>, each second once.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SYMBOLS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE"];
const POLL_MS = 240_000;
const MS_PER_SECOND = 1_000;
const MS_PER_HOUR = 3_600_000;

const [outDir, hours, origin = "https://api.senryo.xyz"] = process.argv.slice(2);
if (!outDir || !hours) {
  console.error("usage: record-recent.mjs <out-dir> <hours> [api-origin]");
  process.exit(1);
}
const dir = join(outDir, "pyth-1s");
mkdirSync(dir, { recursive: true });
const last = new Map();
for (const s of SYMBOLS) {
  const path = join(dir, `${s}.csv`);
  const rows = existsSync(path) ? readFileSync(path, "utf8").trim().split("\n") : [];
  last.set(s, rows.length ? Number(rows[rows.length - 1].split(",")[0]) : 0);
}

async function poll() {
  const res = await fetch(`${origin}/v1/prices/recent?symbols=${SYMBOLS.join(",")}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { feeds } = await res.json();
  for (const { symbol, points } of feeds) {
    const fresh = points
      .map(([ms, priceE8]) => [Math.floor(ms / MS_PER_SECOND), priceE8])
      .filter(([t]) => t > last.get(symbol));
    if (fresh.length === 0) continue;
    appendFileSync(join(dir, `${symbol}.csv`), `${fresh.map(([t, p]) => `${t},${p}`).join("\n")}\n`);
    last.set(symbol, fresh[fresh.length - 1][0]);
  }
}

const until = Date.now() + Number(hours) * MS_PER_HOUR;
while (Date.now() < until) {
  try {
    await poll();
  } catch (err) {
    console.error(new Date().toISOString(), err.message);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
console.log("done");
