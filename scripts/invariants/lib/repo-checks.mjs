/**
 * Check rules for Senryo that need more than a single-line pattern.
 * Each export takes (rule, ctx) and returns findings, or { findings, skipped } when what it guards has not landed yet.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { codeLines, readText, walkFiles } from "./walk.mjs";

const MAX_FILE_LINES = 400;
/** Generated code is regenerated, never edited, so the line cap skips it. */
const GENERATED = /(^|\/)(abis|generated)\//;
const FOREIGN_LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb"];

export function fileLength(rule, ctx) {
  const findings = [];
  for (const scope of rule.scopes) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, rule.exts)) {
      if (GENERATED.test(rel)) continue;
      const lines = readText(abs).split("\n").length;
      if (lines > MAX_FILE_LINES) findings.push(finding(rule, `${lines} lines (max ${MAX_FILE_LINES})`, rel));
    }
  }
  return findings;
}

/** pnpm is the only package manager: root pin, and no foreign lockfile anywhere (indexer included). */
export function pnpmOnly(rule, ctx) {
  const findings = [];
  const pkg = JSON.parse(readFileSync(join(ctx.root, "package.json"), "utf8"));
  if (!String(pkg.packageManager ?? "").startsWith("pnpm@")) {
    findings.push(
      finding(rule, `root packageManager must be pnpm@…, got ${pkg.packageManager ?? "none"}`, "package.json"),
    );
  }
  for (const { rel } of walkFiles(ctx.root, ".", FOREIGN_LOCKFILES))
    findings.push(finding(rule, "non-pnpm lockfile", rel));
  return findings;
}

/** iOS clips a glyph whose line box is shorter than its font. */
const STYLE_OBJECT = /\{[^{}]*\}/g;
export function mobileTightLeading(rule, ctx) {
  const findings = [];
  for (const { rel, abs } of walkFiles(ctx.root, "apps/mobile/src", [".ts", ".tsx"], ["apps/mobile/src/theme"])) {
    for (const block of readText(abs).match(STYLE_OBJECT) ?? []) {
      const size = /\bfontSize:\s*([\d.]+)/.exec(block);
      const leading = /\blineHeight:\s*([\d.]+)/.exec(block);
      if (size && leading && Number(leading[1]) < Number(size[1]))
        findings.push(finding(rule, `fontSize ${size[1]} over lineHeight ${leading[1]}`, rel));
    }
  }
  return findings;
}

/**
 * Solidity: every numeric literal other than 0 and 1 must live on a `constant` / `immutable` declaration line
 * (the user's no-magic-numbers rule, enforced where solhint cannot).
 */
const SOL_NUMBER = /(?<![\w.])(\d[\d_]*(?:\.\d+)?(?:e\d+)?)(?![\w.])/g;
const ALLOWED_SOL_LITERALS = new Set(["0", "1"]);
const SOL_EXEMPT_LINE = /\b(constant|immutable)\b|pragma\s+solidity|^\s*import\b/;
export function solNoMagicNumbers(rule, ctx) {
  const findings = [];
  for (const { rel, abs } of walkFiles(ctx.root, "contracts/src", [".sol"])) {
    for (const [lineNo, line] of codeLines(readText(abs))) {
      if (SOL_EXEMPT_LINE.test(line)) continue;
      const stripped = line.replace(/\b(u?int|bytes)\d+\b/g, "").replace(/"[^"]*"/g, "");
      for (const match of stripped.matchAll(SOL_NUMBER)) {
        if (!ALLOWED_SOL_LITERALS.has(match[1]))
          findings.push(finding(rule, `literal ${match[1]} outside a constant`, `${rel}:${lineNo}`));
      }
    }
  }
  return findings;
}

/** User rule: tests are not a deliverable and there are never UI tests. */
const UI_TEST_FILE = /\.(test|spec)\.tsx$/;
const UI_TEST_IMPORT = /from\s+["'](@playwright\/test|@testing-library\/[^"']+|detox|maestro[^"']*)["']/;
export function noUiTests(rule, ctx) {
  const findings = [];
  for (const { rel, abs } of walkFiles(ctx.root, "apps", [".ts", ".tsx", ".js", ".mjs"])) {
    if (UI_TEST_FILE.test(rel)) findings.push(finding(rule, "UI test file", rel));
    for (const [lineNo, line] of codeLines(readText(abs))) {
      if (UI_TEST_IMPORT.test(line)) findings.push(finding(rule, "UI test framework import", `${rel}:${lineNo}`));
    }
  }
  return findings;
}

/** No committed env files (except examples) and no private-key-shaped literals next to key names. */
const ENV_FILE = /(^|\/)\.env(\.[\w-]+)?$/;
const KEY_LITERAL = /(PRIVATE|SECRET|_PK\b|privateKey|mnemonic)[^\n]{0,40}0x[0-9a-fA-F]{64}\b/;
export function noSecretsInTree(rule, ctx) {
  const findings = [];
  for (const { rel } of walkFiles(ctx.root, ".", [""])) {
    if (ENV_FILE.test(rel) && !rel.endsWith(".env.example"))
      findings.push(finding(rule, "env file must not be committed", rel));
  }
  for (const scope of [
    "apps",
    "packages",
    "services",
    "scripts",
    "contracts/src",
    "contracts/script",
    "indexer/src",
    "deploy",
  ]) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, [
      ".ts",
      ".tsx",
      ".mjs",
      ".js",
      ".sol",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
    ])) {
      for (const [lineNo, line] of codeLines(readText(abs))) {
        if (KEY_LITERAL.test(line)) findings.push(finding(rule, "private-key-shaped literal", `${rel}:${lineNo}`));
      }
    }
  }
  return findings;
}

/** The indexer is self-contained: absent from the pnpm workspace, with its own lockfile once it exists. */
export function indexerIsolated(rule, ctx) {
  const ws = readFileSync(join(ctx.root, "pnpm-workspace.yaml"), "utf8");
  const findings = [];
  if (/^\s*-\s*["']?indexer/m.test(ws))
    findings.push(finding(rule, "indexer must not be a workspace member", "pnpm-workspace.yaml"));
  if (!existsSync(join(ctx.root, "indexer/package.json"))) return { findings, skipped: "indexer not scaffolded yet" };
  if (!existsSync(join(ctx.root, "indexer/pnpm-lock.yaml")))
    findings.push(finding(rule, "indexer needs its own pnpm-lock.yaml", "indexer"));
  return { findings };
}

/** Each app keeps a 21st design record (colors, installed components, source of every RN port). */
export function designJsonPresent(rule, ctx) {
  const findings = [];
  let present = 0;
  for (const app of ["apps/web", "apps/mobile"]) {
    if (!existsSync(join(ctx.root, app))) continue;
    present += 1;
    const file = join(ctx.root, app, ".21st/design.json");
    if (!existsSync(file)) {
      findings.push(finding(rule, "missing .21st/design.json", app));
      continue;
    }
    const colors = JSON.parse(readFileSync(file, "utf8"))?.design?.colors ?? {};
    if (Object.keys(colors).length === 0)
      findings.push(finding(rule, "design.colors is empty", `${app}/.21st/design.json`));
  }
  return present === 0 ? { findings, skipped: "no apps yet" } : { findings };
}

/** Our deployed addresses must agree between the contracts export and the indexer config. */
export function addressDrift(rule, ctx) {
  const dir = join(ctx.root, "packages/contracts/src/addresses");
  const indexerConfig = join(ctx.root, "indexer/config.yaml");
  if (!existsSync(dir) || !existsSync(indexerConfig)) return { findings: [], skipped: "no deployments yet" };
  const config = readFileSync(indexerConfig, "utf8").toLowerCase();
  const findings = [];
  for (const { rel, abs } of walkFiles(ctx.root, "packages/contracts/src/addresses", [".json"])) {
    const book = JSON.parse(readFileSync(abs, "utf8"));
    for (const [name, value] of Object.entries(book.contracts ?? {})) {
      const address = String(value.address ?? value).toLowerCase();
      if (value.indexed !== false && !config.includes(address))
        findings.push(finding(rule, `${name} ${address} missing from indexer/config.yaml`, rel));
    }
  }
  return { findings };
}
