import type { ReactNode } from "react";
import { Text } from "react-native";
import { HERO_FONT_SCALE, TYPE, useTheme } from "~/theme";

/**
 * A tab root's title in its fixed bar (Markets, Card, Social, You): Inter Display, never scrolls away (C16). With large
 * text it shrinks to fit beside the mode control rather than truncating.
 */
export function TabTitle({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={HERO_FONT_SCALE}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[TYPE.pageTitle, { color: color.ink }]}
    >
      {children}
    </Text>
  );
}
