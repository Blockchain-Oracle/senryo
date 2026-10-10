/** R3.3 (D-300): the shape table the contract deploys and the one the client prices with are both what
 *  `scripts/calibrate/table.json` renders to — re-rendered here and compared byte for byte. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readTable, renderSol, renderTs, SOL_OUT, TS_OUT } from "../../calibrate/tail-table.mjs";
import { finding } from "./report.mjs";

export function tailTableSync(rule, ctx) {
  const table = readTable(ctx.root);
  const findings = [];
  for (const [path, want] of [
    [SOL_OUT, renderSol(table)],
    [TS_OUT, renderTs(table)],
  ]) {
    const got = readFileSync(join(ctx.root, path), "utf8");
    if (got !== want)
      findings.push(finding(rule, "differs from table.json — run node scripts/calibrate/codegen.mjs", path));
  }
  return findings;
}
