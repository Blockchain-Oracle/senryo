/**
 * Font provenance (S1b.6, D-192): every font file the apps ship, with its owner, source, licence, retrieval date and
 * sha256 — recorded the way `@senryo/identity` records marks. The invariant `font-provenance` re-hashes each file and
 * fails on an unregistered font. Plain data: no platform code.
 */

export interface FontFile {
  /** Repo-root-relative path of the shipped file. */
  path: string;
  sha256: string;
  /** Path inside the release archive (first-party files are byte-for-byte copies). */
  from?: string;
}

export interface FontSource {
  family: string;
  owner: string;
  /** `first-party`: byte-for-byte from the owner's release; `derived`: instanced/subset from a pinned first-party file. */
  provenance: "first-party" | "derived";
  pageUrl: string;
  /** The exact file or archive downloaded, with its sha256. */
  source: { url: string; sha256: string };
  licence: string;
  /** Licence texts shipped next to the fonts. */
  licenceFiles: readonly string[];
  /** ISO date the source was retrieved. */
  retrieved: string;
  /** How derived files were produced (tool, version, parameters). */
  derivation?: string;
  files: readonly FontFile[];
}

export const FONT_SOURCES: readonly FontSource[] = [
  {
    family: "Inter / Inter Display",
    owner: "Rasmus Andersson / The Inter Project Authors",
    provenance: "first-party",
    pageUrl: "https://github.com/rsms/inter/releases/tag/v4.1",
    source: {
      url: "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip",
      sha256: "9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e",
    },
    licence:
      "SIL Open Font License 1.1 (LICENSE.txt in the release: Copyright (c) 2016 The Inter Project Authors). Static Inter 400/500/600/700 and the static Inter Display SemiBold are both in the official v4.1 release (extras/ttf, web/).",
    licenceFiles: ["apps/mobile/assets/fonts/LICENSE-Inter.txt", "apps/web/src/app/fonts/LICENSE-Inter.txt"],
    retrieved: "2026-10-01",
    files: [
      {
        path: "apps/mobile/assets/fonts/Inter-Regular.ttf",
        sha256: "40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82",
        from: "extras/ttf/Inter-Regular.ttf",
      },
      {
        path: "apps/mobile/assets/fonts/Inter-Medium.ttf",
        sha256: "97ad806f526e41546d46365bb3a393145f75b7b1568913db74549ad8b8dba872",
        from: "extras/ttf/Inter-Medium.ttf",
      },
      {
        path: "apps/mobile/assets/fonts/Inter-SemiBold.ttf",
        sha256: "78a843fade9d4612a5567302fb595b56976eb5fcebf4fea5a5912d638bafcde3",
        from: "extras/ttf/Inter-SemiBold.ttf",
      },
      {
        path: "apps/mobile/assets/fonts/Inter-Bold.ttf",
        sha256: "288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f",
        from: "extras/ttf/Inter-Bold.ttf",
      },
      {
        path: "apps/mobile/assets/fonts/InterDisplay-SemiBold.ttf",
        sha256: "0310d7a325896129730c6c8cf9a6e0f81ee258bedf77b1ff059b2a7b75f74e02",
        from: "extras/ttf/InterDisplay-SemiBold.ttf",
      },
    ],
  },
  {
    family: "Inter / Inter Display (web, Latin subset)",
    owner: "Rasmus Andersson / The Inter Project Authors",
    provenance: "derived",
    pageUrl: "https://github.com/rsms/inter/releases/tag/v4.1",
    source: {
      url: "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip",
      sha256: "9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e",
    },
    licence:
      "SIL Open Font License 1.1 (Inter Project Authors); subsetting is a permitted Modified Version and Inter has no Reserved Font Name.",
    licenceFiles: ["apps/web/src/app/fonts/LICENSE-Inter.txt"],
    retrieved: "2026-10-01",
    derivation:
      "fontTools 4.66.1: subset.Subsetter of the release's web/*.woff2 to U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0100-024F,U+2020,U+20A0-20C0,U+2113,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2713-2717,U+27E8-27E9 (Latin, Latin Extended-A/B, currency, arrows, math, geometric shapes, check marks, angle brackets), every OpenType feature kept (tnum, cv*, ss*), WOFF2. Keeps the web preload small (~48 KB per face instead of ~113 KB); the mobile TTFs stay complete.",
    files: [
      {
        path: "apps/web/src/app/fonts/Inter-Regular-latin.woff2",
        sha256: "c11aaa47f424ae77301d9dbb9b29a2babb5adc2617666c6ed365cd365db3797d",
        from: "web/Inter-Regular.woff2",
      },
      {
        path: "apps/web/src/app/fonts/Inter-Medium-latin.woff2",
        sha256: "76c31cb1ec753c737354b66ec636451fd0dec3a69340f5f52d96659ae851523f",
        from: "web/Inter-Medium.woff2",
      },
      {
        path: "apps/web/src/app/fonts/Inter-SemiBold-latin.woff2",
        sha256: "ffc9e06a2ed4b0534a0fb866928bf15b09dcdec4eb85a5500b2b301a2933fd5e",
        from: "web/Inter-SemiBold.woff2",
      },
      {
        path: "apps/web/src/app/fonts/Inter-Bold-latin.woff2",
        sha256: "1a834c862b099c1d81ecf0b9d465c7f0251b7027b3aa85ab45df5f718b67e5d5",
        from: "web/Inter-Bold.woff2",
      },
      {
        path: "apps/web/src/app/fonts/InterDisplay-SemiBold-latin.woff2",
        sha256: "0b66332e31b33bf43f154b9bb8260fa2e545d0b38079db0dc532e1274c437613",
        from: "web/InterDisplay-SemiBold.woff2",
      },
    ],
  },
  {
    family: "Noto Sans JP (subset)",
    owner: "Adobe / Google (Noto CJK), via google/fonts",
    provenance: "derived",
    pageUrl: "https://github.com/google/fonts/tree/66a36c8c94b1a5d992ee4e7f392fccfe4945767c/ofl/notosansjp",
    source: {
      url: "https://raw.githubusercontent.com/google/fonts/66a36c8c94b1a5d992ee4e7f392fccfe4945767c/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf",
      sha256: "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
    },
    licence:
      "SIL Open Font License 1.1 (OFL.txt in google/fonts ofl/notosansjp: Copyright 2014-2021 Adobe, Reserved Font Name 'Source'). The subset keeps the Noto Sans JP names; the reserved name 'Source' is not used.",
    licenceFiles: ["apps/mobile/assets/fonts/OFL-NotoSansJP.txt", "apps/web/src/app/fonts/OFL-NotoSansJP.txt"],
    retrieved: "2026-10-01",
    derivation:
      'fontTools 4.66.1: varLib.instancer wght=400/500/600/700, then subset.Subsetter(text="千両金箔", layout_features=*, name_IDs=*, notdef_outline) — the only Japanese glyphs the apps render; recalcTimestamp off so the output is reproducible. TTF for mobile, WOFF2 for web.',
    files: [
      {
        path: "apps/mobile/assets/fonts/NotoSansJP-Regular-subset.ttf",
        sha256: "6eef77eca75c6a505de9223f810d15422ec5f75008206dccb1fd0487e5e8115c",
      },
      {
        path: "apps/web/src/app/fonts/NotoSansJP-Regular-subset.woff2",
        sha256: "c7a989d539b5fed765b2f3b6272112c77effaf2ece4a557c070afc895e3f9ef5",
      },
      {
        path: "apps/mobile/assets/fonts/NotoSansJP-Medium-subset.ttf",
        sha256: "65b415f2816f56cda09e0f982a055e57caac256d01cf15027cf736c2a140bc0b",
      },
      {
        path: "apps/web/src/app/fonts/NotoSansJP-Medium-subset.woff2",
        sha256: "c914e8ce607d108db7a3be0cb26c2a056fbe714394e33ce40fc4d01995d77a18",
      },
      {
        path: "apps/mobile/assets/fonts/NotoSansJP-SemiBold-subset.ttf",
        sha256: "d36c867171acaffc8f895a6d9e2e43e621f93bbaeeb15a50b7aad142ff8431e0",
      },
      {
        path: "apps/web/src/app/fonts/NotoSansJP-SemiBold-subset.woff2",
        sha256: "17f608afa9e09e8dfc822f8137ad77e7219ea365f054e1710c6e28cc5f42c450",
      },
      {
        path: "apps/mobile/assets/fonts/NotoSansJP-Bold-subset.ttf",
        sha256: "084fcdba6a8c2dcf6b33e136ae79fe90adbdb147b70ea00136ee6de7f1b3bad1",
      },
      {
        path: "apps/web/src/app/fonts/NotoSansJP-Bold-subset.woff2",
        sha256: "2d6ad0b9654fe03fd211701e62f2bd2ebf2beb5ff462c922c342f1133d3bbb8d",
      },
    ],
  },
];
