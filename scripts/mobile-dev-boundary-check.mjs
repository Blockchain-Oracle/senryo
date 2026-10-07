import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** Evaluate the actual development gate with independent release/development globals, without a native runtime. */
const source = readFileSync(new URL("../apps/mobile/src/lib/dev/config.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
for (const [development, optIn, enabled] of [
  [false, "1", false],
  [false, undefined, false],
  [true, undefined, false],
  [true, "1", true],
]) {
  const exports = {};
  let calls = 0;
  runInNewContext(compiled, {
    exports,
    __DEV__: development,
    process: { env: { EXPO_PUBLIC_DEV_WORKSPACE: optIn } },
    fetch: async () => {
      calls++;
      return { ok: true };
    },
    JSON,
    Error,
  });
  assert.equal(exports.DEV_WORKSPACE, enabled);
  if (!enabled) await assert.rejects(() => exports.devControl("reset"), /disabled/);
  assert.equal(calls, 0, "Disabled development control must not make a request");
  for (const endpoint of [exports.DEV_ORIGIN, exports.DEV_RPC]) assert.equal(new URL(endpoint).hostname, "127.0.0.1");
}
console.log(
  "PASS actual development gate: Release ignores opt-in; disabled controls make no requests; endpoints are loopback",
);
