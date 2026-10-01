/**
 * identity-provenance (S1b.1): every mark is real and traceable.
 * - Each artwork record has an owner, a source page, a licence/usage note, a retrieval date and, per variant file, a
 *   sha256 that matches the bytes on disk (first-party files are never re-pinned; `codegen --rehash` touches only
 *   Senryo originals).
 * - No source contains `<text>` (type is outlined), and every file under the identity sources is registered.
 * - The generated components are current: `src/generated/manifest.json` pins the same hashes, and every variant has a
 *   native and a web component.
 * - Every entity resolves to an artwork record or states a gap; ids are unique; practice token addresses equal the
 *   address book, so a redeploy can't silently orphan their marks.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { finding } from "./report.mjs";

const PKG = "packages/identity";
const SOURCE_DIRS = ["packages/identity/sources", "brand/art"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MIN_LICENCE_CHARS = 24;
const PROVENANCE = new Set(["first-party", "public-domain", "senryo-original"]);
const ADDRESS_BOOK = "packages/contracts/src/addresses/10143.json";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const posix = (p) => p.split(sep).join("/");

function listSvgs(root, dir) {
  const start = join(root, dir);
  if (!existsSync(start)) return [];
  const out = [];
  const visit = (d) => {
    for (const name of readdirSync(d)) {
      const abs = join(d, name);
      if (statSync(abs).isDirectory()) visit(abs);
      else if (name.endsWith(".svg")) out.push(posix(relative(root, abs)));
    }
  };
  visit(start);
  return out;
}

function checkSource(rule, root, source, manifest, registered) {
  const findings = [];
  const where = `${PKG}/src/art (${source.key})`;
  const need = (ok, message) => (ok ? null : findings.push(finding(rule, message, where)));
  need(source.owner, "owner is missing");
  need(PROVENANCE.has(source.provenance), `unknown provenance "${source.provenance}"`);
  need(source.pageUrl, "source page is missing");
  need((source.licence ?? "").length >= MIN_LICENCE_CHARS, "licence/usage note is missing or too short");
  need(ISO_DATE.test(source.retrieved ?? ""), "retrieval date must be YYYY-MM-DD");
  if (source.provenance !== "senryo-original") need(/^https:\/\//.test(source.pageUrl), "source page must be https");
  const variants = Object.entries(source.variants ?? {});
  need(variants.length > 0, "no variants on file");
  for (const [variant, file] of variants) {
    const label = `${source.key}/${variant}`;
    registered.add(file.path);
    if (source.provenance !== "senryo-original") need(/^https:\/\//.test(file.url), `${label}: file URL must be https`);
    need(SHA256.test(file.sha256 ?? ""), `${label}: sha256 missing`);
    need(file.viewBox, `${label}: viewBox missing`);
    const abs = join(root, file.path);
    if (!existsSync(abs)) {
      findings.push(finding(rule, `${label}: file not found`, file.path));
      continue;
    }
    const bytes = readFileSync(abs);
    const actual = sha256(bytes);
    if (actual !== file.sha256) findings.push(finding(rule, `${label}: sha256 ${actual} ≠ registry`, file.path));
    if (/<text[\s>]/.test(bytes.toString("utf8"))) findings.push(finding(rule, `${label}: contains <text>`, file.path));
    if (manifest[label] !== file.sha256)
      findings.push(
        finding(rule, `${label}: generated components are stale — run codegen`, `${PKG}/src/generated/manifest.json`),
      );
    const stem = `${source.key}-${variant.toLowerCase()}.tsx`;
    for (const platform of ["native", "web"]) {
      const generated = join(root, PKG, "src/generated", platform, stem);
      if (!existsSync(generated))
        findings.push(finding(rule, `${label}: no ${platform} component`, `${PKG}/src/generated/${platform}`));
      else if (/\b(Text|TSpan|TextPath)\b/.test(readFileSync(generated, "utf8").split("\n").slice(0, 4).join("\n")))
        findings.push(
          finding(rule, `${label}: generated component imports text`, `${PKG}/src/generated/${platform}/${stem}`),
        );
    }
  }
  return findings;
}

export async function identityProvenance(rule, ctx) {
  const root = ctx.root;
  if (!existsSync(join(root, PKG, "src/art/index.ts"))) return { findings: [], skipped: "identity package not landed" };
  const load = (rel) => import(pathToFileURL(join(root, PKG, rel)).href);
  const [{ ART_SOURCES }, { ENTITIES }, { PRACTICE_TOKENS }] = await Promise.all([
    load("src/art/index.ts"),
    load("src/entities.ts"),
    load("src/constants.ts"),
  ]);
  const manifestPath = join(root, PKG, "src/generated/manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const findings = [];
  const registered = new Set();
  const keys = new Set();
  for (const source of ART_SOURCES) {
    if (keys.has(source.key)) findings.push(finding(rule, `duplicate artwork key ${source.key}`, `${PKG}/src/art`));
    keys.add(source.key);
    findings.push(...checkSource(rule, root, source, manifest, registered));
  }
  for (const dir of SOURCE_DIRS) {
    for (const rel of listSvgs(root, dir)) {
      if (!registered.has(rel)) findings.push(finding(rule, "artwork file is not in the registry", rel));
    }
  }
  const seen = new Set();
  for (const e of ENTITIES) {
    if (seen.has(e.id)) findings.push(finding(rule, `duplicate entity ${e.id}`, `${PKG}/src/entities.ts`));
    seen.add(e.id);
    if (e.art !== undefined && !keys.has(e.art))
      findings.push(finding(rule, `${e.id}: artwork "${e.art}" is not registered`, `${PKG}/src/entities.ts`));
    if (e.art === undefined && !(e.gap ?? "").trim())
      findings.push(finding(rule, `${e.id}: no artwork and no recorded gap`, `${PKG}/src/entities.ts`));
  }
  const book = JSON.parse(readFileSync(join(root, ADDRESS_BOOK), "utf8")).contracts ?? {};
  const mocks = { ausd: book.MockAUSD?.address, usdc: book.MockUSDC?.address };
  for (const [name, address] of Object.entries(PRACTICE_TOKENS)) {
    if (String(mocks[name]).toLowerCase() !== address.toLowerCase())
      findings.push(
        finding(rule, `practice ${name} ${address} ≠ address book ${mocks[name]}`, `${PKG}/src/constants.ts`),
      );
  }
  return { findings };
}
