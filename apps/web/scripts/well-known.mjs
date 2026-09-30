#!/usr/bin/env node
/**
 * `.well-known` generator (S6.9) — emits the two association files the rpId host must serve so iOS and Android use
 * the same passkeys as the web (Mera: "the rpId is the account"):
 *   public/.well-known/apple-app-site-association  (webcredentials + applinks, Team ID + bundle id from @senryo/config)
 *   public/.well-known/assetlinks.json              (get_login_creds + handle_all_urls for ANDROID_CERT_SHA256S)
 * Values are public identifiers, never secrets, and live in @senryo/config (APPLE_TEAM_ID, IOS_BUNDLE_ID,
 * ANDROID_PACKAGE, ANDROID_CERT_SHA256S). No placeholder is ever written: with no certificate, assetlinks is skipped.
 * A local build signed by another key (e.g. a debug keystore) can add certificates with `ANDROID_CERT_SHA256`
 * (comma-separated) or `~/.config/senryo/android.env`; the script warns, because anything served in production must
 * be in config. `--check` fails if the committed files differ from what would be generated (gate/CI).
 *
 * Usage: pnpm --filter @senryo/web well-known [--check]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANDROID_CERT_SHA256S,
  ANDROID_PACKAGE,
  APPLE_TEAM_ID,
  IOS_BUNDLE_ID,
  WELL_KNOWN,
} from "../../../packages/config/src/hosts.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");
const ANDROID_ENV = join(homedir(), ".config", "senryo", "android.env");
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const TEAM_ID = /^[A-Z0-9]{10}$/;
const JSON_INDENT = 2;

/**
 * Paths that open the app when tapped as a universal/app link (the same paths as the web, plan §2.4). The landing
 * page, judge guide and `.well-known` stay on the web. S12 adds the in-app allowlist (`isAppPath`) for push links.
 */
const APP_LINK_PATHS = [
  "/portfolio/*",
  "/markets/*",
  "/trade/*",
  "/positions/*",
  "/orders/*",
  "/activity/*",
  "/alerts/*",
  "/card/*",
  "/fund/*",
  "/withdraw/*",
  "/lp/*",
  "/account/*",
  "/status/*",
  "/watch/*",
];

function readEnvFile(file, name) {
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const [key, ...rest] = line.trim().split("=");
    if (key === name)
      return rest
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function fingerprints() {
  const raw = process.env.ANDROID_CERT_SHA256 ?? readEnvFile(ANDROID_ENV, "ANDROID_CERT_SHA256") ?? "";
  const local = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const list = [...new Set([...ANDROID_CERT_SHA256S, ...local])];
  const bad = list.filter((f) => !FINGERPRINT.test(f));
  if (bad.length > 0) throw new Error(`${bad.length} malformed Android certificate fingerprint(s) (want AA:BB:… ×32)`);
  const extra = local.filter((f) => !ANDROID_CERT_SHA256S.includes(f));
  if (extra.length > 0)
    console.warn(`⚠ ${extra.length} certificate(s) from env are not in @senryo/config — local only`);
  return list;
}

function appleAppSiteAssociation() {
  if (!TEAM_ID.test(APPLE_TEAM_ID)) throw new Error("APPLE_TEAM_ID in @senryo/config is not a 10-character Team ID");
  const appId = `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`;
  return {
    applinks: { details: [{ appIDs: [appId], components: APP_LINK_PATHS.map((path) => ({ "/": path })) }] },
    webcredentials: { apps: [appId] },
  };
}

function assetLinks(certs) {
  return [
    {
      relation: ["delegate_permission/common.get_login_creds", "delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: certs },
    },
  ];
}

const render = (value) => `${JSON.stringify(value, null, JSON_INDENT)}\n`;

function main() {
  const check = process.argv.includes("--check");
  const certs = fingerprints();
  const outputs = [[WELL_KNOWN.appleAppSiteAssociation, render(appleAppSiteAssociation())]];
  if (certs.length > 0) outputs.push([WELL_KNOWN.assetLinks, render(assetLinks(certs))]);
  let drift = 0;
  for (const [path, body] of outputs) {
    const file = join(PUBLIC, path);
    const current = existsSync(file) ? readFileSync(file, "utf8") : undefined;
    if (check) {
      if (current !== body) {
        drift += 1;
        console.error(`✗ ${path} differs from config — run: pnpm --filter @senryo/web well-known`);
      } else console.log(`✓ ${path}`);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    console.log(`wrote ${path}`);
  }
  if (certs.length === 0) {
    console.log(
      `○ ${WELL_KNOWN.assetLinks} not generated: no Android signing SHA-256 yet (set ANDROID_CERT_SHA256 or ${ANDROID_ENV})`,
    );
  }
  if (drift > 0) process.exit(1);
}

main();
