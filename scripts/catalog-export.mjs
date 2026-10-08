#!/usr/bin/env node
/**
 * catalog-export — `packages/config/src/catalog.ts` (D-268) → `contracts/script/catalog/<chainId>.json`, the one input
 * of `contracts/script/DeployMarkets.s.sol`. Foundry can't read TypeScript, so the catalogue is flattened here.
 *
 *   node scripts/catalog-export.mjs            (both networks)
 *
 * Keys are sorted alphabetically inside every object: forge's `parseJson` decodes objects into structs by key order.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BAND_KIND_CODE,
  bandMenu,
  marketsOn,
  POOL_TERMS,
  PRINT_CLASSES,
  PYTH_RECEIVER,
  sigmaE8Of,
  TESTNET_POOL_SEED,
} from "../packages/config/src/catalog.ts";
import { MAINNET_USDC } from "../packages/config/src/money.ts";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "../packages/config/src/networks.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "contracts/script/catalog");
const BYTES32_HEX = 64;
const ADDRESS_HEX = 40;

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

function exportChain(chainId) {
  const terms = POOL_TERMS[chainId];
  const crypto = PRINT_CLASSES.crypto;
  const series = marketsOn(chainId).flatMap((m) =>
    m.cadences.map((cadence) =>
      sorted({
        bands: bandMenu(m, cadence).map((b) =>
          sorted({ highBps: b.highBps, kind: BAND_KIND_CODE[b.kind], lowBps: b.lowBps }),
        ),
        cadenceSec: cadence,
        calendarId: m.calendarId,
        feedId: m.pythFeedId,
        market: marketKey(m.symbol),
        sigmaE8: sigmaE8Of(m),
        symbol: m.symbol,
      }),
    ),
  );
  const doc = sorted({
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
    verifier: sorted(crypto),
  });
  writeFileSync(join(OUT, `${chainId}.json`), `${JSON.stringify(doc, null, 2)}\n`);
  return series.length;
}

mkdirSync(OUT, { recursive: true });
for (const chainId of [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID]) {
  console.log(`catalog ${chainId}: ${exportChain(chainId)} series`);
}
