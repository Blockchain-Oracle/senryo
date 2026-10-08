/**
 * Prints presence (never values) of the environment each stage needs. Reads process env plus ~/.config/senryo/*.env.
 * Usage: pnpm env:check [--stage S3]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Variables grouped by the stage that first needs them (see docs/plan/pivot-2026-10-08.md). */
const REQUIRED_BY_STAGE = {
  S1b: ["EXPO_TOKEN", "APPLE_TEAM_ID"],
  S2: ["DEPLOYER_PK"],
  S3: ["SPONSOR_PK", "KEEPER_PK", "DATABASE_URL", "API_SESSION_SECRET", "ALCHEMY_API_KEY", "PYTH_API_KEY"],
  S4: ["ENVIO_API_TOKEN"],
  S9: ["AURORA_API_KEY"],
};

const CONFIG_DIR = join(homedir(), ".config", "senryo");

function loadConfigDir() {
  const found = new Set();
  if (!existsSync(CONFIG_DIR)) return found;
  for (const name of readdirSync(CONFIG_DIR)) {
    if (!name.endsWith(".env")) continue;
    for (const line of readFileSync(join(CONFIG_DIR, name), "utf8").split("\n")) {
      const key = line.split("=")[0]?.trim();
      if (key && !key.startsWith("#") && line.includes("=") && line.split("=").slice(1).join("=").trim() !== "")
        found.add(key);
    }
  }
  return found;
}

const stageArg = process.argv.includes("--stage") ? process.argv[process.argv.indexOf("--stage") + 1] : null;
const fromFiles = loadConfigDir();
let missing = 0;
for (const [stage, keys] of Object.entries(REQUIRED_BY_STAGE)) {
  if (stageArg && stage !== stageArg) continue;
  const marks = keys.map((key) => {
    const present = Boolean(process.env[key]) || fromFiles.has(key);
    if (!present) missing += 1;
    return `${key} ${present ? "[x]" : "[ ]"}`;
  });
  console.log(`${stage}: ${marks.join(" · ")}`);
}
console.log(`\n${missing} missing (values are never printed)`);
