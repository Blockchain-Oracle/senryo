import {
  MAX_FONT_SCALE_CONTROL,
  MAX_FONT_SCALE_HERO,
  TYPE as TOKEN_TYPE,
  type TypeFace,
  type TypeRole,
} from "@senryo/tokens";
import type { TextStyle } from "react-native";

/**
 * Loaded face names (expo-font keys in fonts.ts). Inter 400–700 for UI; Roboto Condensed Black for display amounts
 * and titles; Noto Sans JP for Japanese text (React Native does not fall back per glyph to a custom font, so Japanese runs set
 * `jp*` explicitly). The `mono*` names are legacy aliases from D2's monospace amounts: they resolve to Inter, and numbers
 * get tabular lining figures.
 */
export const FONT = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansStrong: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  display: "RobotoCondensed_900Black",
  jp: "NotoSansJP_400Regular",
  jpMedium: "NotoSansJP_500Medium",
  jpStrong: "NotoSansJP_600SemiBold",
  jpBold: "NotoSansJP_700Bold",
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

/** Every token role as an RN text style: the step-1 names plus displayBalance/Margin/Price, row, meta, titles, controls. */
export const TYPE = Object.fromEntries(
  (Object.keys(TOKEN_TYPE) as TypeRole[]).map((role) => [role, toStyle(role)]),
) as Readonly<Record<TypeRole, TextStyle>>;

/** Dynamic Type cap for hero numbers so a six-digit balance never wraps. */
export const HERO_FONT_SCALE = MAX_FONT_SCALE_HERO;
/** Dynamic Type cap for dense controls (buttons, chips, tabs, value and market rows, the ticket). */
export const CONTROL_FONT_SCALE = MAX_FONT_SCALE_CONTROL;
/** Past this Dynamic Type scale a row of side-by-side cells has no room: they stack, one per line. */
export const STACK_FONT_SCALE = 1.2;
