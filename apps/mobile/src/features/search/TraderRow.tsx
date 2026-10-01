import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { TraderAvatar, type TraderIdentity, traderDetail, traderName } from "./TraderAvatar";

/**
 * A trader in a list (search results, recents; Fomo F06/F30 row anatomy): avatar, name, the @handle or short address
 * under it — the same bare, 64 pt row as a market, so mixed results line up. Opens the trader's page (`/watch/…`);
 * `onOpen` runs first (Search remembers what was opened).
 */
export function TraderRow({ trader, onOpen }: { trader: TraderIdentity; onOpen?: () => void }) {
  const { color } = useTheme();
  const name = traderName(trader);
  const detail = traderDetail(trader);
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onOpen?.();
        router.push(watchRoute(trader.address));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Trader ${name}, ${detail}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <TraderAvatar trader={trader} size={SIZE.markDetail} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
