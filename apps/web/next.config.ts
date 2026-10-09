import type { NextConfig } from "next";

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
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
