/**
 * Privacy plate (spec session-policy §2): while the app is not in the foreground, the app-switcher snapshot shows the
 * seal on the D2 ground instead of balances, positions or a recovery phrase.
 */
import { StyleSheet, Text, View } from "react-native";
import { useAccount } from "~/lib/account/provider";
import { FONT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function PrivacyPlate() {
  const { color } = useTheme();
  const { obscured } = useAccount();
  if (!obscured) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.plate, { backgroundColor: color.ground }]}
    >
      <View style={[styles.seal, { borderColor: color.primary }]}>
        <Text style={[styles.glyph, { color: color.primary }]}>千</Text>
      </View>
      <Text style={[TYPE.label, { color: color.inkMuted }]}>SENRYO · LOCKED WHILE AWAY</Text>
    </View>
  );
}

/** Above every route and sheet. */
const PLATE_Z = 1000;

const styles = StyleSheet.create({
  plate: { alignItems: "center", justifyContent: "center", gap: SPACE.lg, zIndex: PLATE_Z },
  seal: {
    width: SIZE.seal,
    height: SIZE.seal,
    borderWidth: SIZE.sealStroke,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: { fontSize: SIZE.sealGlyph, lineHeight: SIZE.seal, fontFamily: FONT.sansBold },
});
