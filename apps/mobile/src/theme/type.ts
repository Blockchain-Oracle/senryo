import { MAX_FONT_SCALE_HERO, TYPE as TOKEN_TYPE, type TypeFace, type TypeRole } from "@senryo/tokens";
import type { TextStyle } from "react-native";

/**
 * Loaded face names (expo-font keys in fonts.ts). Inter 400–700 for UI; `display` is the big-number face. The `mono*`
 * names are legacy aliases from D2's monospace amounts: they resolve to Inter, and numbers get tabular lining figures.
 */
export const FONT = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansStrong: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  display: "Inter_600SemiBold",
  mono: "Inter_400Regular",
  monoMedium: "Inter_500Medium",
  monoStrong: "Inter_600SemiBold",
} as const;

const WEIGHT = { medium: 500, strong: 600, bold: 700 } as const;

/** Money and other changing figures align in columns: tabular + lining figures (Inter's `tnum`/`lnum`). */
export const NUMERIC_VARIANT: TextStyle["fontVariant"] = ["tabular-nums", "lining-nums"];

function face(font: TypeFace, weight: number): string {
  if (font === "display") return FONT.display;
  if (weight >= WEIGHT.bold) return FONT.sansBold;
  if (weight >= WEIGHT.strong) return FONT.sansStrong;
  return weight >= WEIGHT.medium ? FONT.sansMedium : FONT.sans;
}

/** Token type scale → RN text styles; tracking is em in the tokens, points here. Sentence case: no text transform. */
function toStyle(role: TypeRole): TextStyle {
  const t = TOKEN_TYPE[role];
  return {
    fontFamily: face(t.font, t.weight),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    letterSpacing: t.tracking * t.size,
    ...(t.numeric ? { fontVariant: NUMERIC_VARIANT } : {}),
  };
}

export const TYPE = {
  micro: toStyle("micro"),
  label: toStyle("label"),
  caption: toStyle("caption"),
  body: toStyle("body"),
  bodyStrong: toStyle("bodyStrong"),
  title: toStyle("title"),
  numSm: toStyle("numSm"),
  numMd: toStyle("numMd"),
  numTicker: toStyle("numTicker"),
  numLg: toStyle("numLg"),
  numXl: toStyle("numXl"),
  numHero: toStyle("numHero"),
} satisfies Record<TypeRole, TextStyle>;

/** Dynamic Type cap for hero numbers so a six-digit balance never wraps. */
export const HERO_FONT_SCALE = MAX_FONT_SCALE_HERO;
