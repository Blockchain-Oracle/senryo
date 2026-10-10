#!/usr/bin/env node
/**
 * Before `next build` (R2.17): a fresh build id in `public/version.json`, which `next.config.ts` also reads into the page
 * bundle (`NEXT_PUBLIC_BUILD_ID`), so a page and the server's `/version.json` agree until the next deploy changes the
 * file — then the open page offers Refresh (`lib/use-app-update.ts`). Generated; never committed.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RANDOM_BYTES = 4;
const RADIX = 36;
const build = `${Date.now().toString(RADIX)}-${randomBytes(RANDOM_BYTES).toString("hex")}`;
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "version.json");
writeFileSync(out, `${JSON.stringify({ build })}\n`);
console.log(`build id ${build} → public/version.json`);
