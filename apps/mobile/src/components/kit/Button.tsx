import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";
import { fire } from "~/feedback/fire";
import { DISABLED_OPACITY, HAIRLINE_PX, type Palette, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Living Lacquer button (direction §3, S1b.7): a pill, sentence-case Inter label (no tracked uppercase), primary 56 /
 * compact 44 pt, the blue primary that darkens on press. Replaces the D2 square mono-uppercase button.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  disabled?: boolean;
  /** Stretch across the row (default) or size to the label. */
  block?: boolean;
  leading?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

function tones(variant: ButtonVariant, c: Palette) {
  switch (variant) {
    case "primary":
      return { bg: c.primary, pressed: c.primaryPressed, ink: c.primaryForeground, border: c.primary };
    case "secondary":
      return { bg: c.secondary, pressed: c.rowPressed, ink: c.secondaryForeground, border: c.secondary };
    case "outline":
      return { bg: c.transparent, pressed: c.rowPressed, ink: c.foreground, border: c.border };
    case "ghost":
      return { bg: c.transparent, pressed: c.rowPressed, ink: c.link, border: c.transparent };
    case "destructive":
      return { bg: c.destructiveWash, pressed: c.destructiveWash, ink: c.destructive, border: c.destructive };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  block = true,
  leading,
  accessibilityHint,
  style,
}: Props) {
  const { color } = useTheme();
  const tone = tones(variant, color);
  const inert = disabled || loading;
  return (
    <Pressable
      onPressIn={() => fire("press")}
      {...(onPress ? { onPress } : {})}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: size === "sm" ? SIZE.buttonHeightSm : SIZE.buttonHeight,
          backgroundColor: pressed ? tone.pressed : tone.bg,
          borderColor: tone.border,
          opacity: disabled ? DISABLED_OPACITY : 1,
        },
        block ? styles.block : styles.inline,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.ink} /> : leading}
      <Text style={[styles.label, { color: tone.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: HAIRLINE_PX,
    minHeight: SIZE.touch,
  },
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  label: TYPE.buttonLabel,
});
