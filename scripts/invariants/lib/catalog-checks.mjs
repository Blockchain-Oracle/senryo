/**
 * catalog-append-only (S7.1): live ticks name a market by its index in `MARKETS` (`@senryo/live`), so the catalogue
 * only ever appends. `packages/config/src/market-order.json` is the committed order (written by
 * `scripts/catalog-export.mjs`, which refuses anything but an append); here the catalogue must equal it exactly.
 * catalog-basket-ids (S7.5): each basket's recorded feed id is the hash of its definition as `BasketPrintVerifier`
 * computes it, so the catalogue, the archive and the chain name the same basket.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { finding } from "./report.mjs";

const CATALOG = "packages/config/src/catalog.ts";
/** viem as `@senryo/chain` resolves it (the invariant re-derives ids independently of the chain package's code). */
const CHAIN_PACKAGE = "packages/chain/package.json";
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

export async function catalogBasketIds(rule, ctx) {
  const require = createRequire(join(ctx.root, CHAIN_PACKAGE));
  const [{ MARKETS, basketMembers, feedIdOf }, viem] = await Promise.all([
    import(pathToFileURL(join(ctx.root, CATALOG)).href),
    import(pathToFileURL(require.resolve("viem")).href),
  ]);
  const params = viem.parseAbiParameters("bytes32[], uint16[], int64[]");
  const findings = [];
  for (const m of MARKETS) {
    if (m.source.kind !== "basket") continue;
    const members = basketMembers(m);
    const id = viem.keccak256(
      viem.encodeAbiParameters(params, [
        members.map((x) => feedIdOf(x.market)),
        members.map((x) => x.member.weightBps),
        members.map((x) => x.member.baseE8),
      ]),
    );
    if (id !== m.source.basketId)
      findings.push(
        finding(rule, `${m.symbol}: basketId ${m.source.basketId} but its definition hashes to ${id}`, CATALOG),
      );
  }
  return { findings };
}
