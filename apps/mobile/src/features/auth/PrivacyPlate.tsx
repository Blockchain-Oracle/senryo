/**
 * Privacy plate (spec session-policy §2): while the app is not in the foreground, the app-switcher snapshot shows the
 * real seal (brand/senryo-seal.svg via @senryo/identity, never 千 in a live font) on the ground instead of balances,
 * positions or a recovery phrase.
 */
import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { useAccount } from "~/lib/account/provider";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const SEAL = ids.brand("senryo");

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
      <EntityMark id={SEAL} size={SIZE.seal} variant="symbol" decorative ground={color.ground} />
      <Text style={[TYPE.label, { color: color.inkMuted }]}>SENRYO · LOCKED WHILE AWAY</Text>
    </View>
  );
}

/** Above every route and sheet. */
const PLATE_Z = 1000;

const styles = StyleSheet.create({
  plate: { alignItems: "center", justifyContent: "center", gap: SPACE.lg, zIndex: PLATE_Z },
});
