// The deployed indexer's entrypoint (S4): resume where it left off; if a deploy changed the schema or config in a way
// Envio refuses to resume from, start over in place (`envio start -r`). Every row is re-derived from the chain — a
// testnet resync takes seconds on HyperSync — and the api reads whatever is indexed so far while it catches up.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";

const BIN = createRequire(import.meta.url).resolve("envio/bin.mjs");
/** Envio's refusal text (ResumePlan.incompatibleMessage → Config.incompatibleMessage, envio 3.14). */
const REFUSED = "incompatible with the existing indexer data";

function run(args, onLine) {
  const child = spawn(process.execPath, [BIN, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  for (const [stream, out] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    createInterface({ input: stream }).on("line", (line) => {
      out.write(`${line}\n`);
      onLine(line);
    });
  }
  return new Promise((resolve) => child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1))));
}

let refused = false;
const code = await run(["start"], (line) => {
  if (line.includes(REFUSED)) refused = true;
});
if (!refused) process.exit(code);
process.stdout.write(
  `${JSON.stringify({ msg: "schema or config changed incompatibly — re-indexing from the start block" })}\n`,
);
process.exit(await run(["start", "-r"], () => {}));
