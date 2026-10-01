import localFont from "next/font/local";

/**
 * Living Lacquer faces (D-192), self-hosted with next/font/local (no Google request at build or run time).
 * Inter 400–700 and Inter Display SemiBold come from the official Inter 4.1 release, subset to Latin + Latin Extended-A/B
 * and the UI's symbols; Noto Sans JP is instanced and subset to 千両金箔. Provenance + sha256 live in
 * `packages/tokens/src/fonts.ts` (invariant font-provenance). The CSS variables feed `--font-sans`/`--font-display`
 * in globals.css; CSS falls back per glyph, so Japanese runs pick up Noto Sans JP automatically.
 */
export const inter = localFont({
  src: [
    { path: "./fonts/Inter-Regular-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-Medium-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-SemiBold-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Inter-Bold-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const interDisplay = localFont({
  src: [{ path: "./fonts/InterDisplay-SemiBold-latin.woff2", weight: "600", style: "normal" }],
  variable: "--font-inter-display",
  display: "swap",
});

export const notoSansJp = localFont({
  src: [
    { path: "./fonts/NotoSansJP-Regular-subset.woff2", weight: "400", style: "normal" },
    { path: "./fonts/NotoSansJP-Medium-subset.woff2", weight: "500", style: "normal" },
    { path: "./fonts/NotoSansJP-SemiBold-subset.woff2", weight: "600", style: "normal" },
    { path: "./fonts/NotoSansJP-Bold-subset.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-jp",
  display: "swap",
  adjustFontFallback: false,
});
