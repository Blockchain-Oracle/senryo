import { type ReactNode, useContext } from "react";
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { BUTTON, BUTTON_LIFT, DISABLED_OPACITY, type Palette, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { SurfaceLevel } from "./Surface";
import { usePressScale } from "./usePressScale";

/**
 * The button (Fomo F01 / F09 / F36 / F44): a rounded rectangle — 56 pt with 12 pt corners, 44 pt with 10 — never a
 * full pill and never an outline box. Depth comes from a 1 pt top highlight inside the fill, not from a border.
 * It shrinks to 0.97 under the finger and darkens; a disabled primary turns into the quiet dark plate with muted ink
 * (F08 → F36), so "not yet" and "go" are two different objects, not one faded one.
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

interface Tone {
  bg: string;
  pressed: string;
  ink: string;
  /** Colour of the 1 pt inner highlight; none on text-only buttons. */
  rim: string | null;
  /** Only the filled primary lifts off the page. */
  lift?: boolean;
}

/** Quiet fills step up with their ground: on a sheet (level 1) they are one step lighter than on a page. */
function tones(variant: ButtonVariant, c: Palette, level: number): Tone {
  switch (variant) {
    case "primary":
      return { bg: c.primary, pressed: c.primaryPressed, ink: c.primaryForeground, rim: c.primaryRim, lift: true };
    case "secondary":
      return level > 0
        ? { bg: c.rowPressed, pressed: c.raised2, ink: c.foreground, rim: c.surfaceRim }
        : { bg: c.raised2, pressed: c.rowPressed, ink: c.foreground, rim: c.surfaceRim };
    case "outline":
      return level > 0
        ? { bg: c.raised2, pressed: c.rowPressed, ink: c.foreground, rim: c.surfaceRim }
        : { bg: c.card, pressed: c.raised2, ink: c.foreground, rim: c.surfaceRim };
    case "ghost":
      return { bg: c.transparent, pressed: c.rowPressed, ink: c.link, rim: null };
    case "destructive":
      return { bg: c.destructiveWash, pressed: c.destructiveWash, ink: c.destructive, rim: c.surfaceRim };
  }
}

/** A disabled filled button is the quiet plate (F08's Continue), whatever it becomes when enabled. */
function quiet(c: Palette, level: number): Tone {
  const bg = level > 0 ? c.raised2 : c.card;
  return { bg, pressed: bg, ink: c.text3, rim: c.surfaceRim };
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
  const press = usePressScale();
  const inert = disabled || loading;
  const level = useContext(SurfaceLevel);
  const tone = disabled && variant !== "ghost" ? quiet(color, level) : tones(variant, color, level);
  const compact = size === "sm";
  return (
    <Animated.View style={[block ? styles.block : styles.inline, style, press.style]}>
      <Pressable
        onPressIn={() => {
          fire("press");
          press.onPressIn();
        }}
        onPressOut={press.onPressOut}
        {...(onPress ? { onPress } : {})}
        disabled={inert}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...(accessibilityHint ? { accessibilityHint } : {})}
        accessibilityState={{ disabled: inert, busy: loading }}
        style={({ pressed }) => [
          styles.base,
          {
            height: compact ? SIZE.buttonHeightSm : SIZE.buttonHeight,
            borderRadius: compact ? BUTTON.radius.sm : BUTTON.radius.md,
            backgroundColor: pressed ? tone.pressed : tone.bg,
          },
          tone.rim
            ? { boxShadow: `inset 0px ${BUTTON.rim}px 0px 0px ${tone.rim}${tone.lift ? `, ${BUTTON_LIFT}` : ""}` }
            : null,
          disabled && variant === "ghost" ? styles.faded : null,
        ]}
      >
        {loading ? <ActivityIndicator size="small" color={tone.ink} /> : leading}
        <Text style={[compact ? TYPE.buttonCompact : TYPE.buttonLabel, { color: tone.ink }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    minHeight: SIZE.touch,
  },
  faded: { opacity: DISABLED_OPACITY },
});
