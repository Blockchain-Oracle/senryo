import type { NextConfig } from "next";

/** Static export served by nginx on the apex rpId (D-011). No server features, no API routes. */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: [
    "@senryo/account",
    "@senryo/api-client",
    "@senryo/chain",
    "@senryo/config",
    "@senryo/contracts",
    "@senryo/core",
    "@senryo/identity",
    "@senryo/query",
    "@senryo/tokens",
  ],
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
