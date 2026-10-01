/**
 * Exchanges for the send-from-exchange route: Coinbase, Binance, Kraken (press kits partly gated).
 * First-party files kept byte-for-byte in packages/identity/sources/ (retrieved 2026-09-30); codegen only
 * normalises them for rendering. Gaps and licence flags are named in each record, never papered over.
 */
import type { ArtSource } from "../types.ts";

export const EXCHANGE_ART: readonly ArtSource[] = [
  {
    key: "coinbase",
    supplement: "lib-coinbase",
    owner: "Coinbase, Inc.",
    provenance: "first-party",
    pageUrl: "https://www.coinbase.com/press",
    licence:
      "Press kit (coinbase_logos.zip) holds the wordmark only; no licence grant — the press footer reserves review of any use and asks not to alter the wordmark (flagged). The mono C is from Coinbase's own design system (github.com/coinbase/cds, Apache-2.0 code, no trademark grant); the colour C disc is the 512 px icon coinbase.com lists in its web manifest (site-hosted, raster). Used nominatively to identify Coinbase.",
    retrieved: "2026-09-30",
    usage: "The press kit has no symbol; the symbol files are site-hosted / official-repo (see each URL).",
    variants: {
      disc: {
        path: "packages/identity/sources/coinbase/coinbase-favicon-512.png",
        url: "https://www.coinbase.com/img/favicon/favicon-512.png",
        sha256: "f52c840214c237d8288f6f0b578b5dc6c2ffd0f4c3d4c66682a22adedfa84806",
        viewBox: "0 0 512 512",
        insetPermille: 0,
        surface: "any",
        shape: "disc",
      },
      monoDark: {
        path: "packages/identity/sources/coinbase/coinbase-symbol-cds-glyph.svg",
        url: "https://raw.githubusercontent.com/coinbase/cds/8dc31aa1efc9312efceec6cd0a998be01606d218/packages/icons/src/svgs/coinbase-24-active.svg",
        sha256: "5ee5868230509a30fc09902d6897191bb2e7083b63ba801a6cbd528dd187275b",
        viewBox: "0 0 24 24",
        insetPermille: 82,
        surface: "light",
        shape: "free",
      },
      wordmark: {
        path: "packages/identity/sources/coinbase/coinbase-wordmark.svg",
        url: "https://downloads.ctfassets.net/q5ulk4bp65r7/55HCidNuiUBEMrOipt5gUl/b5285f163bab1ebd67809d5f599b3a22/coinbase_logos.zip",
        archive: {
          url: "https://downloads.ctfassets.net/q5ulk4bp65r7/55HCidNuiUBEMrOipt5gUl/b5285f163bab1ebd67809d5f599b3a22/coinbase_logos.zip",
          sha256: "f5b73dd128b9656fa26e289d5ca76fcbbf0d47392fe902d60fe4547dc75c9cc8",
          path: "Coinbase logos/SVG/Coinbase_Wordmark.svg",
        },
        sha256: "30d25757eb1642c2de7b026262827d08cf45f1d942b507df8c804cba57b3eec6",
        viewBox: "0 0 1101.64 196.79",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
      wordmarkLight: {
        path: "packages/identity/sources/coinbase/coinbase-wordmark-white.svg",
        url: "https://downloads.ctfassets.net/q5ulk4bp65r7/55HCidNuiUBEMrOipt5gUl/b5285f163bab1ebd67809d5f599b3a22/coinbase_logos.zip",
        archive: {
          url: "https://downloads.ctfassets.net/q5ulk4bp65r7/55HCidNuiUBEMrOipt5gUl/b5285f163bab1ebd67809d5f599b3a22/coinbase_logos.zip",
          sha256: "f5b73dd128b9656fa26e289d5ca76fcbbf0d47392fe902d60fe4547dc75c9cc8",
          path: "Coinbase logos/SVG/Coinbase_Wordmark_White.svg",
        },
        sha256: "a4cd3b11e0394b32c3b930bbe59dcd68f1cadf18fb3c6b9ed08cfb079c8113f0",
        viewBox: "0 0 1101.64 196.79",
        insetPermille: 0,
        surface: "dark",
        shape: "free",
      },
    },
  },
  {
    key: "binance",
    supplement: "lib-binance",
    owner: "Binance",
    provenance: "first-party",
    pageUrl: "https://www.binance.com/en-GB/press",
    licence:
      "Press kit gated: the pressroom's Media Assets link to a password-protected Binance Style Guide (the library supplement fills it: art/generated/fetched.ts). This 200 px symbol is served by Binance's own CDN (site-hosted raster). No explicit licence; used nominatively to identify Binance.",
    retrieved: "2026-09-30",
    usage: "No vector symbol is public; raster used as delivered.",
    variants: {
      symbol: {
        path: "packages/identity/sources/binance/binance-symbol-200.png",
        url: "https://bin.bnbstatic.com/static/images/bnb-for/brand.png",
        sha256: "83eef421c3682a87d0a7107f6872a1e36222cb1623ade9211b817ee2dfc0059b",
        viewBox: "0 0 200 200",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "kraken",
    supplement: "lib-kraken",
    owner: "Payward, Inc. (Kraken)",
    provenance: "first-party",
    pageUrl: "https://www.kraken.com/press",
    licence:
      "Logos are provided on request (press@kraken.com) and brand.kraken.com is password-protected (the library supplement fills it: art/generated/fetched.ts). This tile is the Kraken app icon served by Kraken's own CMS (assets-cms.kraken.com). No explicit licence; used nominatively to identify Kraken.",
    retrieved: "2026-09-30",
    usage: "No bare vector symbol is public.",
    variants: {
      symbol: {
        path: "packages/identity/sources/kraken/kraken-app-icon.svg",
        url: "https://assets-cms.kraken.com/images/51n36hrp/facade/d0f1f312fb60e79892d6c61b3bce79b41c2c9986-1024x1024.svg",
        sha256: "ca91bbec180f787373b68367c9ff112779fbfe1df3bcc8b99f563afeab57c8c3",
        viewBox: "0 0 1024 1024",
        insetPermille: 0,
        surface: "any",
        shape: "tile",
      },
    },
  },
];
