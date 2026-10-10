import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/** The build id `scripts/build-id.mjs` wrote for this build (none under `next dev`: no update check there). */
const VERSION_FILE = join(process.cwd(), "public", "version.json");
const BUILD_ID = existsSync(VERSION_FILE)
  ? (JSON.parse(readFileSync(VERSION_FILE, "utf8")) as { build: string }).build
  : "";

/** Static export served by nginx on the apex rpId (D-011). No server features, no API routes. */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: [
    "@senryo/account",
    "@senryo/api-client",
    "@senryo/calls",
    "@senryo/chain",
    "@senryo/config",
    "@senryo/contracts",
    "@senryo/core",
    "@senryo/identity",
    "@senryo/live",
    "@senryo/query",
    "@senryo/tokens",
  ],
  // Our packages are barrels (one index per package): import only the modules a page uses, so a page that never signs
  // never ships viem or the passkey crypto.
  experimental: {
    optimizePackageImports: [
      "@senryo/account",
      "@senryo/api-client",
      "@senryo/calls",
      "@senryo/chain",
      "@senryo/config",
      "@senryo/core",
      "@senryo/identity",
      "@senryo/live",
      "@senryo/query",
      "@senryo/tokens",
    ],
  },
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
