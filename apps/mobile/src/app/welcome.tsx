import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { FONT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * First launch (F01 entry / F03): the seal, one line of value, Create account (S6 passkey) and "Look around first",
 * which opens Markets without an account. The brand intro and value pages land with S6 onboarding.
 */
export default function Welcome() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const enter = (path: typeof ROUTES.markets | typeof ROUTES.accountRequired) => {
    storage.set(STORAGE_KEYS.welcomed, true);
    fire("confirm");
    if (path === ROUTES.markets) router.replace(path);
    else router.push(path);
  };
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: color.ground, paddingTop: insets.top, paddingBottom: insets.bottom + SPACE.xl },
      ]}
    >
      <View style={styles.center}>
        <View style={[styles.seal, { borderColor: color.primary }]}>
          <Text style={[styles.sealGlyph, { color: color.primary }]}>千</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.word, { color: color.ink }]}>
          SENRYO
        </Text>
        <Text style={[TYPE.body, styles.line, { color: color.inkMuted }]}>
          Gold, silver and crypto perps on one balance — and a card that spends the same dollar.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Create account" onPress={() => enter(ROUTES.accountRequired)} />
        <Button label="Look around first" variant="outline" onPress={() => enter(ROUTES.markets)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SIZE.gutter, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.lg },
  seal: {
    width: SIZE.seal,
    height: SIZE.seal,
    borderWidth: SIZE.sealStroke,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sealGlyph: { fontSize: SIZE.sealGlyph, lineHeight: SIZE.seal, fontFamily: FONT.sansBold },
  word: { ...TYPE.numLg, fontFamily: FONT.monoStrong },
  line: { textAlign: "center" },
  actions: { gap: SPACE.md },
});
