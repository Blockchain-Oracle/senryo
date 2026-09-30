import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { Icon } from "./Icon";

/** A settings/list row: title, optional detail, a chevron when it navigates or a trailing control when it doesn't. */
export function ListRow({
  title,
  detail,
  onPress,
  trailing,
  first = false,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  first?: boolean;
}) {
  const { color } = useTheme();
  const body = (
    <>
      <View style={styles.text}>
        <Text style={[TYPE.body, { color: color.ink }]}>{title}</Text>
        {detail ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{detail}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron" size={SIZE.iconSm} tint={color.inkMuted} /> : null)}
    </>
  );
  const border = first ? null : { borderTopWidth: HAIRLINE_PX, borderTopColor: color.hairline };
  if (!onPress) return <View style={[styles.row, border]}>{body}</View>;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, border, pressed ? { backgroundColor: color.muted } : null]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md, minHeight: SIZE.touch },
  text: { flex: 1, gap: SPACE.xxs },
});
