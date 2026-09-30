import { MAX_FONT_SCALE_HERO, TYPE as TOKEN_TYPE, type TypeRole } from "@senryo/tokens";
import type { TextStyle } from "react-native";

/** Loaded face names (expo-font keys in fonts.ts): Inter for labels, JetBrains Mono (tabular) for every number. */
export const FONT = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansStrong: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoStrong: "JetBrainsMono_600SemiBold",
} as const;

const WEIGHT = { regular: 400, medium: 500, strong: 600 } as const;

function face(font: "sans" | "mono", weight: number): string {
  if (font === "mono") {
    if (weight >= WEIGHT.strong) return FONT.monoStrong;
    return weight >= WEIGHT.medium ? FONT.monoMedium : FONT.mono;
  }
  if (weight >= WEIGHT.strong) return FONT.sansStrong;
  return weight >= WEIGHT.medium ? FONT.sansMedium : FONT.sans;
}

/** Token type scale → RN text styles; tracking is em in the tokens, points here. Numbers are always tabular. */
function toStyle(role: TypeRole): TextStyle {
  const t = TOKEN_TYPE[role];
  return {
    fontFamily: face(t.font, t.weight),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    letterSpacing: t.tracking * t.size,
    ...(t.uppercase ? { textTransform: "uppercase" as const } : {}),
    ...(t.font === "mono" ? { fontVariant: ["tabular-nums" as const] } : {}),
  };
}

export const TYPE = {
  label: toStyle("label"),
  caption: toStyle("caption"),
  body: toStyle("body"),
  bodyStrong: toStyle("bodyStrong"),
  title: toStyle("title"),
  numSm: toStyle("numSm"),
  numMd: toStyle("numMd"),
  numLg: toStyle("numLg"),
  numHero: toStyle("numHero"),
} satisfies Record<TypeRole, TextStyle>;

/** Dynamic Type cap for hero numbers so a six-digit balance never wraps. */
export const HERO_FONT_SCALE = MAX_FONT_SCALE_HERO;
