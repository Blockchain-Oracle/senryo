#!/usr/bin/env node
/**
 * catalog-export — `packages/config/src/catalog.ts` (D-268) → `contracts/script/catalog/<chainId>.json`, the one input
 * of `contracts/script/DeployMarkets.s.sol`. Foundry can't read TypeScript, so the catalogue is flattened here.
 *
 *   node scripts/catalog-export.mjs            (both networks)
 *
 * Keys are sorted alphabetically inside every object: forge's `parseJson` decodes objects into structs by key order.
 * Calendars (D-289) carry the week for the US Eastern offset in effect at export and the next `HOLIDAY_DAYS` of
 * holidays and early closes; the keeper keeps both current on chain after that.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CALENDARS } from "../packages/config/src/calendars.ts";
import { BAND_KIND_CODE, bandMenu, feedIdOf, MARKETS, marketsOn, sigmaE8Of } from "../packages/config/src/catalog.ts";
import { MAINNET_USDC } from "../packages/config/src/money.ts";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "../packages/config/src/networks.ts";
import {
  POOL_TERMS,
  PRINT_CLASS_OF,
  PRINT_CLASSES,
  PYTH_RECEIVER,
  TESTNET_POOL_SEED,
} from "../packages/config/src/pool-terms.ts";
import { easternOffsetSec, holidayWindows, parseSchedule, weekBits } from "../packages/core/src/market/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "contracts/script/catalog");
const BYTES32_HEX = 64;
const ADDRESS_HEX = 40;
/** Holidays exported ahead of today (the contract keeps at most 32 per calendar). */
const HOLIDAY_DAYS = 120;
const MAX_HOLIDAYS = 32;
const MS_PER_SECOND = 1000;

/** ASCII symbol, left-aligned in a bytes32 (Solidity `bytes32("BTC")`). */
function marketKey(symbol) {
  return `0x${Buffer.from(symbol, "ascii").toString("hex").padEnd(BYTES32_HEX, "0")}`;
}

function sorted(obj) {
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((k) => [k, obj[k]]),
  );
}

/** Every calendar a market on this chain uses (0, always open, is never configured on chain). */
function calendarsOf(markets, nowSec) {
  const ids = [...new Set(markets.map((m) => m.calendarId))].filter((id) => id !== 0).sort();
  return ids.map((id) => {
    const schedule = parseSchedule(CALENDARS[id].schedule);
    const holidays = holidayWindows(schedule, nowSec, HOLIDAY_DAYS);
    if (holidays.length > MAX_HOLIDAYS)
      throw new Error(`calendar ${id}: ${holidays.length} holidays > ${MAX_HOLIDAYS}`);
    return sorted({
      holidayEnds: holidays.map((h) => h.end),
      holidayStarts: holidays.map((h) => h.start),
      id,
      name: CALENDARS[id].name,
      week: weekBits(schedule, easternOffsetSec(nowSec)).map((w) => w.toString()),
    });
  });
}

function exportChain(chainId) {
  const terms = POOL_TERMS[chainId];
  const markets = marketsOn(chainId);
  const series = markets.flatMap((m) =>
    m.cadences.map((cadence) =>
      sorted({
        bands: bandMenu(m, cadence).map((b) =>
          sorted({ highBps: b.highBps, kind: BAND_KIND_CODE[b.kind], lowBps: b.lowBps }),
        ),
        cadenceSec: cadence,
        calendarId: m.calendarId,
        feedId: feedIdOf(m),
        market: marketKey(m.symbol),
        sigmaE8: sigmaE8Of(m),
        symbol: m.symbol,
        verifierClass: PRINT_CLASS_OF[m.kind],
      }),
    ),
  );
  const doc = sorted({
    calendars: calendarsOf(markets, Math.floor(Date.now() / MS_PER_SECOND)),
    chainId,
    // Mainnet calls are in Circle USDC; testnet deploys its own Test USD (zero here = deploy it).
    collateral: chainId === MAINNET_CHAIN_ID ? MAINNET_USDC : `0x${"0".repeat(ADDRESS_HEX)}`,
    params: sorted({
      halfSpreadE6: terms.halfSpreadE6,
      maxExpiryReserved: terms.maxExpiryReserved.toString(),
      maxExposureBps: terms.maxExposureBps,
      maxProbE6: terms.maxProbE6,
      maxStake: terms.maxStake.toString(),
      maxSurchargeE6: terms.maxSurchargeE6,
      minProbE6: terms.minProbE6,
      minStake: terms.minStake.toString(),
    }),
    poolSeed: chainId === TESTNET_CHAIN_ID ? TESTNET_POOL_SEED.toString() : "0",
    pyth: PYTH_RECEIVER[chainId],
    series,
    session: sorted({
      maxPerCallCap: terms.session.perCallCap.toString(),
      maxSessionCap: terms.session.sessionCap.toString(),
      maxSessionSec: terms.session.maxSessionSec,
    }),
    verifiers: Object.fromEntries(Object.entries(PRINT_CLASSES).map(([k, c]) => [k, sorted(c)])),
  });
  writeFileSync(join(OUT, `${chainId}.json`), `${JSON.stringify(doc, null, 2)}\n`);
  return series.length;
}

/** Live ticks carry a market's catalogue index, so the order only appends (invariant `catalog-append-only`). */
function lockOrder() {
  const path = join(ROOT, "packages/config/src/market-order.json");
  const now = MARKETS.map((m) => m.symbol);
  const was = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
  was.forEach((symbol, i) => {
    if (now[i] !== symbol) throw new Error(`market ${i} was ${symbol}, now ${now[i] ?? "gone"}: markets only append`);
  });
  writeFileSync(path, `${JSON.stringify(now)}\n`);
}

lockOrder();
mkdirSync(OUT, { recursive: true });
for (const chainId of [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID]) {
  console.log(`catalog ${chainId}: ${exportChain(chainId)} series`);
}
