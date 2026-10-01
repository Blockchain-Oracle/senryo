import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "~/components/kit/Icon";
import { SessionChip } from "~/features/auth/SessionChip";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { FONT, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The top strip as a solid header: wordmark left, the session chip, the Practice/Mainnet mode capsule (S8.22), then
 * alerts and account. The tabs themselves live at the bottom (NativeTabs), so the strip carries no tab row.
 */
export function TopStrip() {
  const network = useNetwork();
  const { color } = useTheme();
  const practice = network.key === "testnet";
  const tone = practice ? color.practice : color.mainnet;
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
          {/* The mode capsule (S8.22, Living Lacquer §5.6): always visible, one tap to the Practice ↔ Mainnet selector. */}
          <Pressable
            onPress={() => {
              fire("tick");
              router.push(ROUTES.network);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${practice ? "Practice, paper money" : "Mainnet, real money"}. Change network`}
            hitSlop={SPACE.xs}
            style={[
              styles.net,
              { borderColor: tone, backgroundColor: practice ? color.practiceWash : color.mainnetWash },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: tone }]} />
            <Text style={[TYPE.numSm, { color: tone }]}>{practice ? "PRACTICE" : "MAINNET"}</Text>
          </Pressable>
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
  net: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    marginRight: SPACE.xs,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.sm,
    minHeight: SIZE.buttonHeightSm,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
  tap: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
});
