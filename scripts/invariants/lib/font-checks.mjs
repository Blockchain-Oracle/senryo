/**
 * font-provenance (S1b.6, D-192): every shipped font is traceable, like the identity marks.
 * - Each record in `packages/tokens/src/fonts.ts` names an owner, an https source with a sha256, a licence, a retrieval
 *   date, and licence files that exist next to the fonts.
 * - Every listed file exists and its bytes match the recorded sha256.
 * - Every font file in the apps' font folders is registered (nothing ships unrecorded).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { finding } from "./report.mjs";

const RECORDS = "packages/tokens/src/fonts.ts";
const FONT_DIRS = ["apps/mobile/assets/fonts", "apps/web/src/app/fonts"];
const FONT_FILE = /\.(ttf|otf|woff2?)$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_LICENCE_CHARS = 24;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function fontProvenance(rule, ctx) {
  if (!existsSync(join(ctx.root, RECORDS))) return { findings: [], skipped: "no font records yet" };
  const { FONT_SOURCES } = await import(pathToFileURL(join(ctx.root, RECORDS)).href);
  const findings = [];
  const registered = new Set();
  for (const source of FONT_SOURCES) {
    const need = (ok, message) => (ok ? null : findings.push(finding(rule, message, `${RECORDS} (${source.family})`)));
    need(source.owner, "owner is missing");
    need(/^https:\/\//.test(source.pageUrl ?? ""), "source page must be https");
    need(/^https:\/\//.test(source.source?.url ?? ""), "source file URL must be https");
    need(SHA256.test(source.source?.sha256 ?? ""), "source sha256 missing");
    need((source.licence ?? "").length >= MIN_LICENCE_CHARS, "licence note is missing or too short");
    need(ISO_DATE.test(source.retrieved ?? ""), "retrieval date must be YYYY-MM-DD");
    if (source.provenance === "derived") need((source.derivation ?? "").length > 0, "derived fonts must say how");
    for (const licence of source.licenceFiles ?? []) need(existsSync(join(ctx.root, licence)), `missing ${licence}`);
    for (const file of source.files ?? []) {
      registered.add(file.path);
      const abs = join(ctx.root, file.path);
      if (!existsSync(abs)) {
        findings.push(finding(rule, "listed font file is missing", file.path));
        continue;
      }
      if (sha256(readFileSync(abs)) !== file.sha256) findings.push(finding(rule, "sha256 does not match", file.path));
    }
  }
  for (const dir of FONT_DIRS) {
    const abs = join(ctx.root, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      const rel = `${dir}/${name}`;
      if (FONT_FILE.test(name) && !registered.has(rel))
        findings.push(finding(rule, "font file has no provenance record", rel));
    }
  }
  return { findings };
}
