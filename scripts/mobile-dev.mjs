#!/usr/bin/env node
/** One persistent native iteration loop; native compilation is only needed when native dependencies change. */
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REQUEST_TIMEOUT_MS = 1000;
const STARTUP_ATTEMPTS = 40;
const RETRY_MS = 500;
const HTTP_INTERNAL_ERROR = 500;
const HTTP_METHOD_NOT_ALLOWED = 405;
const root = fileURLToPath(new URL("../", import.meta.url));
const logs = "/tmp/senryo-mobile-dev";
mkdirSync(logs, { recursive: true });
const children = [];
let stopping = false;
const stop = () => {
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function start(command, args, name, env = {}) {
  const log = openSync(`${logs}/${name}.log`, "w");
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log],
    detached: true,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name}: ${error.message}`);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${name} stopped (${code}). See ${logs}/${name}.log`);
      stop();
      process.exitCode = 1;
    }
  });
}
const fetchLocal = (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
async function waitFor(url, test) {
  for (let attempt = 0; attempt < STARTUP_ATTEMPTS && !stopping; attempt++) {
    try {
      if (await test(await fetchLocal(url))) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
  throw new Error(`Development service did not start: ${url}. Logs: ${logs}`);
}

try {
  for (const url of ["http://127.0.0.1:18765", "http://127.0.0.1:18766", "http://localhost:8081/status"]) {
    try {
      await fetchLocal(url);
      throw new Error(`A service already uses ${url}. Stop the previous development session before restarting.`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("A service")) throw error;
    }
  }
  start(
    "anvil",
    [
      "--fork-url",
      "https://testnet-rpc.monad.xyz",
      "--network",
      "monad",
      "--port",
      "18765",
      "--host",
      "127.0.0.1",
      "--block-time",
      "1",
      "--mixed-mining",
      "--slots-in-an-epoch",
      "1",
      "--silent",
    ],
    "fork",
    { RUST_LOG: "error" },
  );
  await waitFor("http://127.0.0.1:18765", async (response) => response.status < HTTP_INTERNAL_ERROR);
  start("pnpm", ["--filter", "@senryo/drive", "mobile-dev-server"], "controller");
  await waitFor("http://127.0.0.1:18766", async (response) => response.status === HTTP_METHOD_NOT_ALLOWED);
  start("pnpm", ["--filter", "@senryo/mobile", "dev:workspace", "--port", "8081"], "metro");
  await waitFor("http://localhost:8081/status", async (response) =>
    (await response.text()).includes("packager-status:running"),
  );
  console.log(
    `Native workspace ready. Logs: ${logs}\nOpen your installed Senryo development client at http://localhost:8081.\nDashboard opens automatically. Tap DEV for reset, prices and onboarding. Ctrl+C stops the local services.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop();
  process.exitCode = 1;
}
