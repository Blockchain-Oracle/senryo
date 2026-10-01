import { router, Stack } from "expo-router";
import { Search, Send } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Glyph size inside the send illustration disc. */
const PLANE = 40;

/**
 * Send (the fan's first action; FT058/C38, P22 anatomy; Codex S1b.7 consult #8). The recipient flow (recents, @handle
 * or address search, scan, contacts, review with resolved address) is J8 (S1b.14) and not in this build, so this is a
 * labelled reserved surface — never a fake flow: the recipient row is shown and marked unavailable. Back restores the
 * page under the fan (FT061).
 */
export default function SendScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.lg }]}>
      <Stack.Screen options={{ title: "Send", headerRight: () => <ModeCapsule compact /> }} />
      <View style={styles.center}>
        <View style={[styles.disc, { backgroundColor: color.fanCircle }]}>
          <Send size={PLANE} strokeWidth={SIZE.iconStroke} color={color.fanText} />
        </View>
        <Text accessibilityRole="header" style={[TYPE.sectionTitle, styles.text, { color: color.ink }]}>
          Sending isn’t available in this version.
        </Text>
        <Text style={[TYPE.body, styles.text, { color: color.text2 }]}>
          Transfers to an address or @handle are not enabled yet.
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel="Address or @handle. Unavailable in this version"
        accessibilityState={{ disabled: true }}
        style={[styles.recipient, { borderColor: color.border, backgroundColor: color.card }]}
      >
        <Search size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text3} />
        <Text style={[TYPE.row, styles.flex, { color: color.text3 }]}>Address or @handle</Text>
        <Text style={[TYPE.meta, { color: color.text3 }]}>Unavailable</Text>
      </View>
      <Button label="Back" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.md },
  disc: {
    width: SIZE.avatarXl,
    height: SIZE.avatarXl,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { textAlign: "center" },
  recipient: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.inputHeight,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: HAIRLINE_PX,
  },
  flex: { flex: 1 },
});
