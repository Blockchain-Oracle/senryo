#!/usr/bin/env node
// R3.3 (D-300): writes the fitted table into the contract (`TailTable.sol`) and the client (`tail-table.ts`).
//   node scripts/calibrate/codegen.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTable, renderSol, renderTs, SOL_OUT, TS_OUT } from "./tail-table.mjs";

const root = new URL("../..", import.meta.url).pathname;
const table = readTable(root);
writeFileSync(join(root, SOL_OUT), renderSol(table));
writeFileSync(join(root, TS_OUT), renderTs(table));
console.log(`wrote ${SOL_OUT} and ${TS_OUT}: ${table.taus.length} horizons × ${table.points} points`);
