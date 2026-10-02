/**
 * A Settings row in the iOS Settings grammar (A10; 21st.dev uiable/list-group-badge, id 29345 — icon + title + trailing
 * value in a grouped list, ported without dividers or a border): the glyph in a small rounded square of its own
 * colour, the title, a quiet trailing value, and a chevron when it opens a page — or a control in its place. No
 * subtitles. Destructive rows (Delete my data, Sign out) are the title alone in the down ink.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, type SymbolIcon } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The coloured square (iOS Settings: 29 pt, 7 pt corners) and its white glyph. */
const SQUARE = 30;
const SQUARE_RADIUS = 8;
const GLYPH = 18;

export function SettingsRow({
  title,
  icon: Glyph,
  tint,
  value,
  onPress,
  onLongPress,
  control,
  destructive = false,
}: {
  title: string;
  icon?: SymbolIcon;
  /** The square's colour (a palette role). */
  tint?: string;
  /** Quiet trailing text ("Practice", "30 min"). */
  value?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** A trailing control (a switch) instead of the chevron. */
  control?: ReactNode;
  destructive?: boolean;
}) {
  const { color } = useTheme();
  const body = (
    <>
      {Glyph ? (
        <View style={[styles.square, { backgroundColor: tint ?? color.chartNeutral }]}>
          <Glyph size={GLYPH} strokeWidth={SIZE.iconStroke} color={color.primaryForeground} />
        </View>
      ) : null}
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        numberOfLines={1}
        style={[TYPE.row, styles.title, { color: destructive ? color.down : color.ink }]}
      >
        {title}
      </Text>
      {value ? (
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} numberOfLines={1} style={[TYPE.row, { color: color.text3 }]}>
          {value}
        </Text>
      ) : null}
      {control ??
        (onPress && !destructive ? (
          <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        ) : null)}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible={!control} accessibilityLabel={value ? `${title}, ${value}` : title}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      {...(onLongPress ? { onLongPress } : {})}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.rowPressed } : null]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    minHeight: SIZE.rowMinHeight - SPACE.sm,
  },
  square: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: SQUARE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1 },
});
