/**
 * catalog-append-only (S7.1): live ticks name a market by its index in `MARKETS` (`@senryo/live`), so the catalogue
 * only ever appends. `packages/config/src/market-order.json` is the committed order (written by
 * `scripts/catalog-export.mjs`, which refuses anything but an append); here the catalogue must equal it exactly.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { finding } from "./report.mjs";

const CATALOG = "packages/config/src/catalog.ts";
const LOCK = "packages/config/src/market-order.json";

export async function catalogAppendOnly(rule, ctx) {
  const lockPath = join(ctx.root, LOCK);
  if (!existsSync(lockPath)) return { findings: [finding(rule, "no market order lock — run catalog-export", LOCK)] };
  const { MARKETS } = await import(pathToFileURL(join(ctx.root, CATALOG)).href);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const now = MARKETS.map((m) => m.symbol);
  const findings = [];
  for (let i = 0; i < lock.length; i++) {
    if (now[i] !== lock[i])
      findings.push(
        finding(rule, `market ${i} was ${lock[i]}, now ${now[i] ?? "gone"} — markets only append`, CATALOG),
      );
  }
  if (now.length > lock.length) findings.push(finding(rule, "new markets not locked — run catalog-export", LOCK));
  return { findings };
}
