/**
 * The pivot's 0015 dropped the trading-era tables (feed, follows, moderation, cards…), but three reads still named them
 * and every profile save, inbox read and push failed in production. Replays the migrations in order (CREATE TABLE adds,
 * DROP TABLE removes) and fails any service or package SQL that reads or writes a table that no longer exists.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { readText, walkFiles } from "./walk.mjs";

const MIGRATIONS = "services/common/migrations";
const CODE_SCOPES = ["services", "packages"];
const CREATE = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g;
const DROP = /DROP TABLE (?:IF EXISTS )?([\w\s,]+?)(?:CASCADE)?;/g;

function droppedTables(root) {
  const live = new Set();
  const dropped = new Set();
  for (const name of readdirSync(join(root, MIGRATIONS)).sort()) {
    if (!name.endsWith(".ts")) continue;
    const sql = readText(join(root, MIGRATIONS, name));
    const events = [
      ...[...sql.matchAll(CREATE)].map((m) => ({ at: m.index, create: [m[1]] })),
      ...[...sql.matchAll(DROP)].map((m) => ({ at: m.index, drop: m[1].split(",").map((t) => t.trim()) })),
    ].sort((a, b) => a.at - b.at);
    for (const e of events) {
      for (const t of e.create ?? []) {
        live.add(t);
        dropped.delete(t);
      }
      for (const t of (e.drop ?? []).filter(Boolean)) {
        live.delete(t);
        dropped.add(t);
      }
    }
  }
  return dropped;
}

export function sqlNoDroppedTables(rule, ctx) {
  const dropped = droppedTables(ctx.root);
  if (dropped.size === 0) return { findings: [], skipped: "no dropped tables" };
  const use = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+(${[...dropped].join("|")})\\b`, "g");
  const findings = [];
  for (const scope of CODE_SCOPES) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, [".ts"], [MIGRATIONS])) {
      const source = readText(abs);
      for (const m of source.matchAll(use)) {
        const line = source.slice(0, m.index).split("\n").length;
        findings.push(finding(rule, `line ${line}: SQL names \`${m[1]}\`, which a migration dropped`, rel));
      }
    }
  }
  return { findings };
}
