import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "~/components/kit/Icon";
import { SessionChip } from "~/features/auth/SessionChip";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { SAMPLE_NETWORK } from "~/lib/sample";
import { FONT, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The D2 top strip as a solid header (spec: `SENRYO · ● MONAD 0.3s · bell`): wordmark left, network + block time,
 * then alerts and account. The tabs themselves live at the bottom (NativeTabs), so the strip carries no tab row.
 */
export function TopStrip() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const go = (path: typeof ROUTES.alerts | typeof ROUTES.account) => {
    fire("tick");
    router.push(path);
  };
  return (
    <View
      style={[
        styles.strip,
        { paddingTop: insets.top, backgroundColor: color.ground, borderBottomColor: color.hairline },
      ]}
    >
      <View style={styles.row}>
        <Text accessibilityRole="header" accessibilityLabel="Senryo" style={[styles.word, { color: color.ink }]}>
          SENRYO<Text style={{ color: color.primary }}>/</Text>
          <Text style={{ color: color.inkMuted }}>千両</Text>
        </Text>
        <View style={styles.right}>
          <SessionChip />
          <View
            accessible
            accessibilityLabel={`Network ${SAMPLE_NETWORK.name}, block time ${SAMPLE_NETWORK.blockTimeLabel}`}
            style={styles.net}
          >
            <View style={[styles.dot, { backgroundColor: color.up }]} />
            {/* Block time moved to the label and Status (S6): the session chip needs the room on a 390 pt strip. */}
            <Text style={[TYPE.numSm, { color: color.inkMuted }]}>{SAMPLE_NETWORK.name}</Text>
          </View>
          <Pressable
            onPress={() => go(ROUTES.alerts)}
            accessibilityRole="button"
            accessibilityLabel="Alerts"
            hitSlop={SPACE.sm}
            style={styles.tap}
          >
            <Icon name="bell" tint={color.inkMuted} />
          </Pressable>
          <Pressable
            onPress={() => go(ROUTES.account)}
            accessibilityRole="button"
            accessibilityLabel="Account and settings"
            hitSlop={SPACE.sm}
            style={styles.tap}
          >
            <Icon name="account" tint={color.inkMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderBottomWidth: HAIRLINE_PX },
  row: {
    height: SIZE.strip,
    paddingHorizontal: SIZE.gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  word: { ...TYPE.numMd, fontFamily: FONT.monoStrong },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  net: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginRight: SPACE.xs },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
  tap: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
});
