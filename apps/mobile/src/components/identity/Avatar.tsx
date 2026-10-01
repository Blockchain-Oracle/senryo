import { UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { RADIUS, SIZE, useTheme } from "~/theme";

/** The glyph fills this much of the disc. */
const GLYPH_RATIO = 0.56;

/**
 * A person's avatar. The authored portrait set (twelve illustrated defaults, S1b.3) is still in its art review, so
 * until it merges every account shows the same neutral person disc — never a letter, a colour hash or a fake photo.
 * `avatar` (the profile's authored id) is accepted now so callers don't change when the set lands.
 */
export function Avatar({ size = SIZE.avatarMd }: { avatar?: string | null; size?: number }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, backgroundColor: color.raised2 }]}
    >
      <UserRound size={size * GLYPH_RATIO} strokeWidth={SIZE.iconStroke} color={color.text3} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
});
