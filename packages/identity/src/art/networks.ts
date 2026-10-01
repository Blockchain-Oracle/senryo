/**
 * Networks and their native assets: Monad/MON, Bitcoin, Ethereum, Solana, Base, Arbitrum, Hyperliquid, Zcash.
 * First-party files kept byte-for-byte in packages/identity/sources/ (retrieved 2026-09-30); codegen only
 * normalises them for rendering. Gaps and licence flags are named in each record, never papered over.
 */
import type { ArtSource } from "../types.ts";

export const NETWORK_ART: readonly ArtSource[] = [
  {
    key: "monad",
    owner: "Monad Foundation",
    provenance: "first-party",
    pageUrl: "https://www.monad.xyz/brand-and-media-kit",
    licence:
      'No explicit licence on the kit page. Monad Brand Guidelines v.02.01 (PDF in the kit ZIP): "The logo mark may be used on its own when the full brand name is already present. This includes … web pages, and apps." "Alterations or modifications are not permitted." Trademarks of the Monad Foundation (https://www.monad.xyz/terms-of-service §3.2); used nominatively to identify Monad and MON.',
    retrieved: "2026-09-30",
    usage:
      "Clear space = the logomark's own height/width; Monad Purple #6E54FF. The disc is the kit's MON token (its drop-shadow filter is dropped on native only). The kit ships no standalone mono logomark (gap).",
    variants: {
      disc: {
        path: "packages/identity/sources/monad/mon-token-480.svg",
        url: "https://monad.xyz/brand-page-assets/Token.svg",
        sha256: "5ad0b4aa249fa5c3034dd4656195db01c9f0a95320f4aace24309a705d96ea28",
        viewBox: "0 0 480 480",
        insetPermille: 0,
        surface: "any",
        shape: "disc",
      },
      symbol: {
        path: "packages/identity/sources/monad/logomark-purple.svg",
        url: "https://monad.xyz/brand-page-assets/Logomark.svg",
        archive: {
          url: "https://monad.xyz/brand-page-assets/Monad%20Brand%20and%20Media%20Kit.zip",
          sha256: "8ee806bce77cc62411df855c6be9ab26fd9ccc4538307c3d040bc7389c15cf5b",
          path: "Monad Brand and Media Kit/Logos/Logomark/Logomark.svg",
        },
        sha256: "32ab1d3ce7ce18e9c7531490c0bfe780d6f679702e88da0204df004ca83b34b9",
        viewBox: "0 0 182 184",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "bitcoin",
    owner: "Bitcoin Core project (github.com/bitcoin/bitcoin)",
    provenance: "first-party",
    pageUrl: "https://github.com/bitcoin/bitcoin/blob/master/src/qt/res/src/bitcoin.svg",
    licence:
      'File header: "Designer: Jonas Schnelli / License: MIT" (repository COPYING: MIT). The Bitcoin logo is public domain: "They are in the public domain." (https://en.bitcoin.it/wiki/Promotional_graphics). bitcoin.org publishes the disc only inside its lockups (img/icons, MIT).',
    retrieved: "2026-09-30",
    usage:
      "The reference client's disc (gradient + drop shadow; the filter is dropped on native only). No mono disc is published (gap).",
    variants: {
      disc: {
        path: "packages/identity/sources/bitcoin/bitcoin-disc-core.svg",
        url: "https://raw.githubusercontent.com/bitcoin/bitcoin/master/src/qt/res/src/bitcoin.svg",
        sha256: "86cdf6d03ddd38ca949e8d8e3f34bbc87abed12baf48bf090ce9e5b2339b3542",
        viewBox: "-34 -34 580 580",
        insetPermille: 36,
        surface: "any",
        shape: "disc",
      },
    },
  },
  {
    key: "ethereum",
    owner: "ethereum.org",
    provenance: "first-party",
    pageUrl: "https://ethereum.org/en/assets/",
    licence:
      "ethereum.org Terms of Use: non-code content is \"licensed under the Creative Commons Attribution 4.0 International License\" (https://ethereum.org/en/terms-of-use/); listed under 'Ethereum brand assets'.",
    retrieved: "2026-09-30",
    usage: "CC BY 4.0: credit ethereum.org where sources are listed. No white diamond is published (gap).",
    variants: {
      symbol: {
        path: "packages/identity/sources/ethereum/eth-diamond-purple.svg",
        url: "https://ethereum.org/images/assets/svgs/eth-diamond-purple.svg",
        sha256: "7320e64e211db747308cc3e546e5360d42f3790b7a14fba0504573790e17f124",
        viewBox: "0 0 1920 1920",
        insetPermille: 42,
        surface: "any",
        shape: "free",
      },
      monoDark: {
        path: "packages/identity/sources/ethereum/eth-diamond-gray.svg",
        url: "https://ethereum.org/images/assets/svgs/eth-diamond-black.svg",
        sha256: "4611f65a00cff2e61dd7815aa59cb1bed0e0a266acca7eafc8212e78c7c7d10e",
        viewBox: "0 0 1920 1920",
        insetPermille: 42,
        surface: "light",
        shape: "free",
      },
    },
  },
  {
    key: "solana",
    owner: "Solana Foundation",
    provenance: "first-party",
    pageUrl: "https://solana.com/branding",
    licence:
      'Solana Foundation Brand Guidelines (June 2026, linked from https://solana.com/branding): the marks may not suggest "sponsorship, endorsement or affiliation … where none exists", may not be recoloured or altered, and may not be combined "with any third-party design … unless you have received explicit, written permission". Written permission for badge combinations is open (flagged).',
    retrieved: "2026-09-30",
    usage: "Never recolour; no shadows or outlines; no mono logomark is published (gap).",
    variants: {
      symbol: {
        path: "packages/identity/sources/solana/solana-logomark-gradient.svg",
        url: "https://solana.com/src/img/branding/solanaLogoMark.svg",
        sha256: "3d3401109aa061dec40a8659f1847817a8e647f98de1e65e76e86a95bbe1f08a",
        viewBox: "0 0 101 88",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "base",
    owner: "Base",
    provenance: "first-party",
    pageUrl: "https://brand.base.org/",
    licence:
      'No explicit licence on https://brand.base.org/. Base Brand Guidelines V1.0 (June 2025, in base-brand.zip): "The core identifiers live in only three shades: Base Blue, white, or black." "Do not altar, rearrange, or break apart the squares … Do not add special effects." Used nominatively to identify Base.',
    retrieved: "2026-09-30",
    usage: "The Square is primarily for blue applications; clear space 0.3×.",
    variants: {
      symbol: {
        path: "packages/identity/sources/base/base-square-blue.svg",
        url: "https://brand.base.org/base-brand.zip",
        archive: {
          url: "https://brand.base.org/base-brand.zip",
          sha256: "9e441f02dcb63dc6ffd2048ac3b6568fbcad3a7e9de747eb39d0d4c2dfc02143",
          path: "1_Base Brand Assets/The Square/Base_square_blue.svg",
        },
        sha256: "b4f2b487011713f98481cc53c4ce095629b4876acbdbc2f0f3ad69a9688ba82e",
        viewBox: "0 0 1280 1280",
        insetPermille: 0,
        surface: "any",
        shape: "tile",
      },
      monoLight: {
        path: "packages/identity/sources/base/base-square-white.svg",
        url: "https://brand.base.org/base-brand.zip",
        archive: {
          url: "https://brand.base.org/base-brand.zip",
          sha256: "9e441f02dcb63dc6ffd2048ac3b6568fbcad3a7e9de747eb39d0d4c2dfc02143",
          path: "1_Base Brand Assets/The Square/Base_square_white.svg",
        },
        sha256: "2b29d9c645da49a721fae67213000a963f4a3b71fb1c168aff5f29ffa9622b0d",
        viewBox: "0 0 1280 1280",
        insetPermille: 0,
        surface: "dark",
        shape: "tile",
      },
      monoDark: {
        path: "packages/identity/sources/base/base-square-black.svg",
        url: "https://brand.base.org/base-brand.zip",
        archive: {
          url: "https://brand.base.org/base-brand.zip",
          sha256: "9e441f02dcb63dc6ffd2048ac3b6568fbcad3a7e9de747eb39d0d4c2dfc02143",
          path: "1_Base Brand Assets/The Square/Base_square_black.svg",
        },
        sha256: "78dbcb008bb4c9abb53a675e5ec88cc8636041aa3d26df2cbf89264aa469e40b",
        viewBox: "0 0 1280 1280",
        insetPermille: 0,
        surface: "light",
        shape: "tile",
      },
    },
  },
  {
    key: "arbitrum",
    owner: "Arbitrum (Offchain Labs)",
    provenance: "first-party",
    pageUrl: "https://arbitrum.io/brand-kit",
    licence:
      'https://arbitrum.io/brand-kit LEGAL: "Use of our brand assets must be expressly authorized in writing" and must not mislead about sponsorship or affiliation. Written authorisation is open (flagged).',
    retrieved: "2026-09-30",
    usage:
      "Icon never below 24 px; clear space = half the hexagon's width; full colour is primary, navy on light, white on dark.",
    variants: {
      symbol: {
        path: "packages/identity/sources/arbitrum/arbitrum-logomark-fullcolor-tight.svg",
        url: "https://arbitrum.io/arb_logo_color.svg",
        minPx: 24,
        sha256: "dc738cb57414dbcb8cc56220d13fed7913efa0ca51be028ce2d3dbd7a0329c70",
        viewBox: "0 0 59 68",
        insetPermille: 11,
        surface: "any",
        shape: "free",
      },
      monoLight: {
        path: "packages/identity/sources/arbitrum/arbitrum-logomark-white-tight.svg",
        url: "https://arbitrum.io/brandkit/icon_white.svg",
        minPx: 24,
        sha256: "1638935f2e550a2b87266ec99eff1aa153a46ca9b49250bcb8b2e81a320c3e68",
        viewBox: "0 0 151 172",
        insetPermille: 0,
        surface: "dark",
        shape: "free",
      },
      monoDark: {
        path: "packages/identity/sources/arbitrum/arbitrum-logomark-navy.svg",
        url: "https://arbitrum.io/brandkit/downloads/1225_Arbitrum_Logomark_all.zip",
        archive: {
          url: "https://arbitrum.io/brandkit/downloads/1225_Arbitrum_Logomark_all.zip",
          sha256: "56fcff030dbe468a5c09af7924d8529591220a978148ed6d5f40eb3eaf867256",
          path: "1225_Arbitrum_Logomark_all/1225_Arbitrum_Logomark_OneColorNavy_ClearSpace.svg",
        },
        minPx: 24,
        sha256: "33babd54a6141e90354a3fe85023b8b71d7f007b78fcbe1033261a9bcfcb864c",
        viewBox: "0 0 744 795.68",
        insetPermille: 228,
        surface: "light",
        shape: "free",
      },
    },
  },
  {
    key: "hyperliquid",
    owner: "Hyperliquid",
    provenance: "first-party",
    pageUrl: "https://hyperliquid.gitbook.io/hyperliquid-docs/brand-kit",
    licence:
      "No explicit licence or usage terms on the brand-kit page; trademark of Hyperliquid, used nominatively to identify HYPE. The colour mark is the HYPE coin icon Hyperliquid's own app serves (app.hyperliquid.xyz).",
    retrieved: "2026-09-30",
    usage:
      "Mint on light grounds lacks contrast, so the colour mark asks for a dark ground. HYPE has no separate token art.",
    variants: {
      symbol: {
        path: "packages/identity/sources/hyperliquid/hype-token-app.svg",
        url: "https://app.hyperliquid.xyz/coins/HYPE.svg",
        sha256: "4ef1f539cdd3472fd5ae3cfce4f9f2d85ef747587ae72a191e95e5e171a13f54",
        viewBox: "0 0 144 144",
        insetPermille: 0,
        surface: "dark",
        shape: "free",
      },
      monoLight: {
        path: "packages/identity/sources/hyperliquid/hyperliquid-blob-white.svg",
        url: "https://2356094849-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FyUdp569E6w18GdfqlGvJ%2Fuploads%2F1d7qVbvxY5oGFQAaaJ3a%2FHyperliquid%20SVG%20format.zip?alt=media&token=b6aef86f-fc26-49f5-af2e-51da21bb1feb",
        archive: {
          url: "https://2356094849-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FyUdp569E6w18GdfqlGvJ%2Fuploads%2F1d7qVbvxY5oGFQAaaJ3a%2FHyperliquid%20SVG%20format.zip?alt=media&token=b6aef86f-fc26-49f5-af2e-51da21bb1feb",
          sha256: "80d501c06ac1415dc7153e4ed644ae4f955a0e019b1d300ac97355f2fdf8eb79",
          path: "SVG/Hyperliquid_Blob_Light.svg",
        },
        sha256: "805d8ffe8605dbd1249988cbe1eef11ab1297538fb0f78447cde947b3efc8208",
        viewBox: "0 0 200 200",
        insetPermille: 124,
        surface: "dark",
        shape: "free",
      },
      monoDark: {
        path: "packages/identity/sources/hyperliquid/hyperliquid-blob-dark.svg",
        url: "https://2356094849-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FyUdp569E6w18GdfqlGvJ%2Fuploads%2F1d7qVbvxY5oGFQAaaJ3a%2FHyperliquid%20SVG%20format.zip?alt=media&token=b6aef86f-fc26-49f5-af2e-51da21bb1feb",
        archive: {
          url: "https://2356094849-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FyUdp569E6w18GdfqlGvJ%2Fuploads%2F1d7qVbvxY5oGFQAaaJ3a%2FHyperliquid%20SVG%20format.zip?alt=media&token=b6aef86f-fc26-49f5-af2e-51da21bb1feb",
          sha256: "80d501c06ac1415dc7153e4ed644ae4f955a0e019b1d300ac97355f2fdf8eb79",
          path: "SVG/Hyperliquid_Blob_Dark.svg",
        },
        sha256: "393d7db6117c0a5ab0a8c6bf8b2212e047a1a079f207bc84f3bc1e0d4d639531",
        viewBox: "0 0 200 200",
        insetPermille: 124,
        surface: "light",
        shape: "free",
      },
    },
  },
  {
    key: "zcash",
    owner: "Electric Coin Co. / Zcash Foundation",
    provenance: "first-party",
    pageUrl: "https://z.cash/press/",
    licence:
      'https://z.cash/press/ → Zcash Trademark Policy (https://zfnd.org/zcash-trademark-policy/): "You may use the Word Marks and the Logos to indicate … that your product or service supports the Zcash cryptocurrency." No implied endorsement; never part of our own marks.',
    retrieved: "2026-09-30",
    usage: "The gold brandmark's Z is knocked out: it reads gold/black on a dark ground, which the planner supplies.",
    variants: {
      disc: {
        path: "packages/identity/sources/zcash/zcash-brandmark-yellow.svg",
        url: "https://z.cash/wp-content/uploads/2023/11/Brandmark-Yellow.svg",
        archive: {
          url: "https://z.cash/wp-content/uploads/2023/12/zcash-logos.zip",
          sha256: "c708739efdf60b472c128747a82c256d6932c72c512269d33dacc8a2a373bb33",
          path: "Logos/SVG/Primary Brandmark/Brandmark Yellow.svg",
        },
        sha256: "5adf0bc86b508b554ebf094a4aab0cc63594c9fb83d46faa087b2e5375c09758",
        viewBox: "0 0 1080 1080",
        insetPermille: 250,
        surface: "dark",
        shape: "disc",
      },
      symbol: {
        path: "packages/identity/sources/zcash/zcash-brandmark-outlined-yellow.svg",
        url: "https://z.cash/wp-content/uploads/2023/11/Secondary-Brandmark-Yellow.svg",
        archive: {
          url: "https://z.cash/wp-content/uploads/2023/12/zcash-logos.zip",
          sha256: "c708739efdf60b472c128747a82c256d6932c72c512269d33dacc8a2a373bb33",
          path: "Logos/SVG/Secondary Brandmark/Secondary Brandmark Yellow.svg",
        },
        sha256: "09177df89799365ceb45ab822a8f47008e60d4ba265c9b77eb16784705f5a1be",
        viewBox: "0 0 1080 1080",
        insetPermille: 250,
        surface: "any",
        shape: "free",
      },
      monoLight: {
        path: "packages/identity/sources/zcash/zcash-brandmark-white.svg",
        url: "https://z.cash/wp-content/uploads/2023/11/Brandmark-White.svg",
        archive: {
          url: "https://z.cash/wp-content/uploads/2023/12/zcash-logos.zip",
          sha256: "c708739efdf60b472c128747a82c256d6932c72c512269d33dacc8a2a373bb33",
          path: "Logos/SVG/Primary Brandmark/Brandmark White.svg",
        },
        sha256: "4a219ec6c4581ce1e86545f13ca87599a2c106a048b90ba791b732b82ee77d31",
        viewBox: "0 0 1080 1080",
        insetPermille: 250,
        surface: "dark",
        shape: "disc",
      },
      monoDark: {
        path: "packages/identity/sources/zcash/zcash-brandmark-black.svg",
        url: "https://z.cash/wp-content/uploads/2023/11/Brandmark-Black.svg",
        archive: {
          url: "https://z.cash/wp-content/uploads/2023/12/zcash-logos.zip",
          sha256: "c708739efdf60b472c128747a82c256d6932c72c512269d33dacc8a2a373bb33",
          path: "Logos/SVG/Primary Brandmark/Brandmark Black.svg",
        },
        sha256: "0ab8d49fde449c60651c52f1f5c4cf8552b52e9bdcabc748636af593b01f3914",
        viewBox: "0 0 1080 1080",
        insetPermille: 250,
        surface: "light",
        shape: "disc",
      },
    },
  },
];
