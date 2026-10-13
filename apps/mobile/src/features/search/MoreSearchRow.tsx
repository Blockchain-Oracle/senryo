/**
 * More's way into search (R6.9, Codex direction 13): a 64 pt row before the destinations — the glyph, "Search
 * Senryo" over what it finds, a chevron — for a guest and a signed-in account alike.
 */
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Search } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function MoreSearchRow() {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("press", { cue: "sheetOpen" });
        router.push("/search" as Href);
      }}
      accessibilityRole="search"
      accessibilityLabel="Search Senryo. Markets, positions, games and receipts"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.rowPressed }]}
    >
      <Search size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
      <View style={styles.copy}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Search Senryo</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>Markets, positions, games and receipts</Text>
      </View>
      <ChevronRight size={SIZE.iconSm} color={color.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  copy: { flex: 1, gap: SPACE.xxs },
});
