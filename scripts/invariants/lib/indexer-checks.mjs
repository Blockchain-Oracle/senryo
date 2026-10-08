/**
 * D-173: indexer rows exist once per chain (`<chainId>_<id>` keys, a `chainId` column on every entity), so every read
 * must say which chain it means — a query that forgets mixes Practice and Real rows on one screen. The api reads the
 * indexer's tables over SQL (S4, Hasura off) through `this.t("<Entity>")`; every statement that does must filter on
 * `chainId` (a `"chainId" = …` predicate, or an id built from it).
 */
import { finding } from "./report.mjs";
import { readText, walkFiles } from "./walk.mjs";

const CODE_SCOPES = ["services"];
const TABLE = 'this.t("';
/** One SQL statement in a tagged template: from SELECT to the template's closing backtick + semicolon. */
const STATEMENT = /SELECT[\s\S]*?`;/g;

export function indexerReadsChainFilter(rule, ctx) {
  const findings = [];
  let statements = 0;
  for (const scope of CODE_SCOPES) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, [".ts"])) {
      const source = readText(abs);
      if (!source.includes(TABLE)) continue;
      for (const match of source.matchAll(STATEMENT)) {
        if (!match[0].includes(TABLE)) continue;
        statements += 1;
        if (/chainId/.test(match[0])) continue;
        const line = source.slice(0, match.index).split("\n").length;
        findings.push(finding(rule, `line ${line}: an indexer read without a chainId filter`, rel));
      }
    }
  }
  return statements === 0 ? { findings, skipped: "no indexer reads" } : { findings };
}
