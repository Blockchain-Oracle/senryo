// Bundle services/{api,keeper} into self-contained ESM files for the one-image, two-entrypoint container.
//   node services/common/scripts/bundle.mjs <outdir>
// Output: api.mjs · keeper.mjs · run.mjs (dispatches on SERVICE) · health.mjs (HEALTHCHECK → /health) ·
// redstone-parse.mjs (the api's RedStone parse worker, loaded from beside api.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outdir = resolve(process.argv[2] ?? join(root, "services/dist"));
mkdirSync(outdir, { recursive: true });

// CJS dependencies (fastify, pino, postgres…) call `require` — give the ESM bundle one (esbuild docs: banner.js).
const banner = [
  "import { createRequire as __senryoCreateRequire } from 'node:module';",
  "const require = __senryoCreateRequire(import.meta.url);",
].join("\n");

await build({
  entryPoints: {
    api: join(root, "services/api/src/main.ts"),
    keeper: join(root, "services/keeper/src/main.ts"),
    "redstone-parse": join(root, "services/api/src/prices/redstone-parse.worker.ts"),
  },
  outdir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  banner: { js: banner },
  // ws' optional native accelerators are loaded in try/catch — never bundled.
  external: ["bufferutil", "utf-8-validate"],
  sourcemap: "linked",
  legalComments: "none",
  logLevel: "info",
});

const PORTS = { api: 3000, keeper: 3002 };
writeFileSync(
  join(outdir, "run.mjs"),
  `// SERVICE = api | keeper (one image, two Coolify resources).
const service = process.env.SERVICE;
if (!["api", "keeper"].includes(service)) {
  console.error("SERVICE must be api or keeper");
  process.exit(1);
}
process.env.PORT ??= String(${JSON.stringify(PORTS)}[service]);
await import(\`./\${service}.mjs\`);
`,
);
writeFileSync(
  join(outdir, "health.mjs"),
  `// Container HEALTHCHECK: liveness only (/health), never /ready (deploy-runbook §7).
const port = process.env.PORT ?? String(${JSON.stringify(PORTS)}[process.env.SERVICE] ?? 3000);
try {
  const res = await fetch(\`http://127.0.0.1:\${port}/health\`, { signal: AbortSignal.timeout(2500) });
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
`,
);
console.log(`bundled → ${outdir}`);
