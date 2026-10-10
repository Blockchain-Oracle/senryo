#!/usr/bin/env node
// R3.2 held-out check data (D-300): Pyth's own minute prices from Senryo's archive (`pyth_prints` candles, D-272, kept
// since 8 Oct), through the public `/v1/prices/candles` route — each candle's open is the first price of its minute,
// the boundary print. Bulk history from Pyth Benchmarks is not used: it shares the production Pyth key's quota.
//
//   node scripts/calibrate/fetch-archive.mjs <out-dir> [api-origin]
//
// Writes `pyth/pyth-1m-archive.csv` in <out-dir>: t,symbol,price,conf,expo,publish_time (price × 1e-8; conf 0).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SYMBOLS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE", "TSLA", "QQQ", "XAU", "XAG", "EUR"];
const DAY_SEC = 86_400;
const SPAN_DAYS = 7; // the route's widest range
const SPAN_SEC = SPAN_DAYS * DAY_SEC;
const MS_PER_SECOND = 1_000;
const PRINT_EXPO = -8;

const [outDir, origin = "https://api.senryo.xyz"] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: fetch-archive.mjs <out-dir> [api-origin]");
  process.exit(1);
}
const to = Math.floor(Date.now() / MS_PER_SECOND);
const rows = ["t,symbol,price,conf,expo,publish_time"];
for (const symbol of SYMBOLS) {
  const res = await fetch(`${origin}/v1/prices/candles?symbol=${symbol}&from=${to - SPAN_SEC}&to=${to}`);
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const { candles } = await res.json();
  for (const [minute, open] of candles) rows.push([minute, symbol, open, 0, PRINT_EXPO, minute].join(","));
  console.log(symbol, candles.length);
}
mkdirSync(join(outDir, "pyth"), { recursive: true });
writeFileSync(join(outDir, "pyth", "pyth-1m-archive.csv"), `${rows.join("\n")}\n`);
