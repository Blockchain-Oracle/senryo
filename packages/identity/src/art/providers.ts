/**
 * Stablecoins and providers: USDC, Chainlink, Aurora, Envio, DB-IP.
 * First-party files kept byte-for-byte in packages/identity/sources/ (retrieved 2026-09-30); codegen only
 * normalises them for rendering. Gaps and licence flags are named in each record, never papered over.
 */
import type { ArtSource } from "../types.ts";

export const PROVIDER_ART: readonly ArtSource[] = [
  {
    key: "usdc",
    supplement: "lib-usdc",
    owner: "Circle Internet Group",
    provenance: "first-party",
    pageUrl: "https://www.circle.com/pressroom",
    licence:
      'Circle Brand Use Policy (linked from the pressroom): "NO MODIFICATION" and "NO COMMERCIAL USE: Circle does not permit any use of its Brand Assets for commercial purposes." USDC Brand Guide: "The USDC Token Logo is used to represent the USDC stablecoin in the event of a transaction or a UI context." The commercial-use conflict is flagged. Attribution where feasible: "All trademarks shown are the property of Circle Internet Group, Inc. and/or its affiliates".',
    retrieved: "2026-09-30",
    usage:
      "Token logo ≥ 32 px; always blue, never black or inverted; monochrome contexts need the USDC Symbol, which Circle publishes only as PNG (the library supplement fills it: art/generated/fetched.ts).",
    variants: {
      disc: {
        path: "packages/identity/sources/usdc/usdc-token.svg",
        url: "https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/Pressroom/brandkit/logo-downloads/usdc.zip",
        archive: {
          url: "https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/Pressroom/brandkit/logo-downloads/usdc.zip",
          sha256: "538ce962b272760340db1ff53e8a26ce28f22a573fcd4bc9681f0fd44e1dfa82",
          path: "Token Logo/USDC Token.svg",
        },
        minPx: 32,
        sha256: "fe4f9d5f34ef4ebeb5d80e1f5ff63dcaf5a0d5495f4adf206e4c3011d1f5c57d",
        viewBox: "0 0 96 96",
        insetPermille: 10,
        surface: "any",
        shape: "disc",
      },
    },
  },
  {
    key: "chainlink",
    owner: "Chainlink Foundation",
    provenance: "first-party",
    pageUrl: "https://chain.link/brand-assets",
    licence:
      'Chainlink Trademark Guidelines (https://chain.link/terms#trademark): descriptive use only "when necessary to describe the subject matter"; logo use beyond the guidelines needs prior written consent (legal@chain.link) — flagged.',
    retrieved: "2026-09-30",
    usage: '"Price source" attribution in About/oracle details only; Chainlink is never shown as the execution venue.',
    variants: {
      symbol: {
        path: "packages/identity/sources/chainlink/chainlink-symbol-blue.svg",
        url: "https://cdn.prod.website-files.com/5f6b7190899f41fb70882d08/6aa7fef7f56d1f1d953c589d_Chainlink-Symbol-Blue.svg",
        archive: {
          url: "https://cdn.prod.website-files.com/5f6b7190899f41fb70882d08/6a9849f95bf2c3b1c26d7353_Chainlink-Logo.zip",
          sha256: "bac18b6c8dcd5b4b088b491a13f769195cb22783f104a2eaa02050bd92d0ee80",
          path: "Chainlink-Logo/SVG/Chainlink-Symbol-Blue.svg",
        },
        sha256: "baf12d3c3c62a86c7ae649f5126d8055141d0927954fa355292c18f4a8e0f12e",
        viewBox: "0 0 247 284",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
      monoLight: {
        path: "packages/identity/sources/chainlink/chainlink-symbol-white.svg",
        url: "https://cdn.prod.website-files.com/5f6b7190899f41fb70882d08/6aa7fef7a31aed5b1bf78dd7_Chainlink-Symbol-White.svg",
        archive: {
          url: "https://cdn.prod.website-files.com/5f6b7190899f41fb70882d08/6a9849f95bf2c3b1c26d7353_Chainlink-Logo.zip",
          sha256: "bac18b6c8dcd5b4b088b491a13f769195cb22783f104a2eaa02050bd92d0ee80",
          path: "Chainlink-Logo/SVG/Chainlink-Symbol-White.svg",
        },
        sha256: "1e3545577c2aee8f1fbde72181a47b71b9fb70a12b5254efd8bae60549948b2b",
        viewBox: "0 0 247 284",
        insetPermille: 0,
        surface: "dark",
        shape: "free",
      },
      monoDark: {
        path: "packages/identity/sources/chainlink/chainlink-symbol-black.svg",
        url: "https://cdn.prod.website-files.com/5f6b7190899f41fb70882d08/6aa7fef9544e069b62b31acd_Chainlink-Symbol-Black.svg",
        archive: {
          url: "https://cdn.prod.website-files.com/5f6b7190899f41fb70882d08/6a9849f95bf2c3b1c26d7353_Chainlink-Logo.zip",
          sha256: "bac18b6c8dcd5b4b088b491a13f769195cb22783f104a2eaa02050bd92d0ee80",
          path: "Chainlink-Logo/SVG/Chainlink-Symbol-Black.svg",
        },
        sha256: "1928411ba63045ad971cd13a72c3d884c2f208275c7db1d083aa9aa9d200191b",
        viewBox: "0 0 247 284",
        insetPermille: 0,
        surface: "light",
        shape: "free",
      },
    },
  },
  {
    key: "aurora",
    supplement: "lib-aurora",
    owner: "Aurora Labs",
    provenance: "first-party",
    pageUrl: "https://brand.aurora.dev/",
    licence:
      'Aurora Brand Guidelines + Media Kit 2023 (https://brand.aurora.dev/): "Aurora logo should only be used in our brand colors. Black and white are allowed as an exception if necessary." "It should not be reimagined, tampered with, or modified in any way." The disc is the Aurora Intents app icon (intents.aurora.dev).',
    retrieved: "2026-09-30",
    usage:
      '"Powered by Aurora" only on routes Aurora performs; margin ≥ half the mark\'s width. No mono sign is published (the library supplement fills it: art/generated/fetched.ts).',
    variants: {
      disc: {
        path: "packages/identity/sources/aurora/aurora-intents-app-icon.svg",
        url: "https://intents.aurora.dev/favicon.svg",
        sha256: "968813f4a919dd663b7b71323d5608d36b61975c2a2b55b2df7fc8e3d2d1c4a1",
        viewBox: "0 0 512 512",
        insetPermille: 0,
        surface: "any",
        shape: "tile",
      },
      symbol: {
        path: "packages/identity/sources/aurora/aurora-logomark-green.svg",
        url: "https://brand.aurora.dev/cloudinary/brandpad/raw/upload/v1683129428/22349/aurora-logos.zip",
        archive: {
          url: "https://brand.aurora.dev/cloudinary/brandpad/raw/upload/v1683129428/22349/aurora-logos.zip",
          sha256: "54ce2bfdf18a04c1e8ccf58f2c934d0982ec0124f7855ed8fd4f080f504e3c5a",
          path: "Aurora Logos/AURORA/3 Icon/Aurora-logo-token-trans.svg",
        },
        sha256: "98d9551d8a9179f9359297245d6e5b3d711b1e180e81648943df3bf0dbc26d00",
        viewBox: "0 0 808 808",
        insetPermille: 211,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "envio",
    owner: "Envio",
    provenance: "first-party",
    pageUrl: "https://envio.dev/brand",
    licence:
      "Envio Brand Asset License (LICENSE.txt in envio-brand-kit.zip): you can \"Display a 'Powered by Envio' or 'Integrated with Envio' badge on your product\" and \"Resize the logo proportionally\"; you cannot modify the files or imply a partnership.",
    retrieved: "2026-09-30",
    usage: "Never below 80 px wide in digital contexts.",
    variants: {
      symbol: {
        path: "packages/identity/sources/envio/envio-symbol.svg",
        url: "https://envio.dev/brand-assets/envio-symbol.svg",
        archive: {
          url: "https://envio.dev/brand-assets/envio-brand-kit.zip",
          sha256: "27412f16b0a4aa2ce18ad3b39228a8eeda97e448e4fa375ccc27aaa5b848f4f2",
          path: "envio-symbol.svg",
        },
        minPx: 80,
        sha256: "9c069c804e2cefcb4f2ec38268a5ce6b35d279afa6c01febb21677f67cec5524",
        viewBox: "0 0 400 400",
        insetPermille: 0,
        surface: "any",
        shape: "tile",
      },
      wordmark: {
        path: "packages/identity/sources/envio/envio-logo-primary.svg",
        url: "https://envio.dev/brand-assets/envio-logo-primary.svg",
        archive: {
          url: "https://envio.dev/brand-assets/envio-brand-kit.zip",
          sha256: "27412f16b0a4aa2ce18ad3b39228a8eeda97e448e4fa375ccc27aaa5b848f4f2",
          path: "envio-logo-primary.svg",
        },
        minPx: 80,
        sha256: "69f7a13ebc94a55ebcf99e8d4b2ad814d09dd2b7794bf6cebc5140b634da32d4",
        viewBox: "0 0 390 94",
        insetPermille: 0,
        surface: "light",
        shape: "free",
      },
      wordmarkLight: {
        path: "packages/identity/sources/envio/envio-logo-white.svg",
        url: "https://envio.dev/brand-assets/envio-logo-white.svg",
        archive: {
          url: "https://envio.dev/brand-assets/envio-brand-kit.zip",
          sha256: "27412f16b0a4aa2ce18ad3b39228a8eeda97e448e4fa375ccc27aaa5b848f4f2",
          path: "envio-logo-white.svg",
        },
        minPx: 80,
        sha256: "506cd628a0c9c2de8aa116920e04224563b7128e9ad6f348bfc8eea491c9ac2d",
        viewBox: "0 0 390 94",
        insetPermille: 0,
        surface: "dark",
        shape: "free",
      },
    },
  },
  {
    key: "db-ip",
    owner: "DB-IP",
    provenance: "first-party",
    pageUrl: "https://db-ip.com/",
    licence:
      'No licence for the logo on https://db-ip.com (files served from /img/); used nominatively for the attribution the DB-IP Lite data requires (CC BY 4.0): "IP Geolocation by DB-IP" linking to https://db-ip.com.',
    retrieved: "2026-09-30",
    usage: "DB-IP publishes a wordmark only (no symbol, no kit).",
    variants: {
      wordmark: {
        path: "packages/identity/sources/db-ip/dbip-logo-colour.svg",
        url: "https://db-ip.com/img/footer-logo.svg",
        sha256: "f802a2b132b34bdfe067313692f26a715178f43ecf660e49f0dab146b075137c",
        viewBox: "0 0 372.8 231.9",
        insetPermille: 0,
        surface: "light",
        shape: "free",
      },
      wordmarkLight: {
        path: "packages/identity/sources/db-ip/dbip-logo-reverse.svg",
        url: "https://db-ip.com/img/main-logo.svg",
        sha256: "72900e3736ac55660ae1faeaf7aec11695c8f5ed4e53d921ef4069490ddd2640",
        viewBox: "0 0 372.8 231.9",
        insetPermille: 0,
        surface: "dark",
        shape: "free",
      },
    },
  },
];
