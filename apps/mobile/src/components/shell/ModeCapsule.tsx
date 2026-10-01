import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The persistent mode capsule (S8.22 → Living Lacquer §5.6, FT044): "Practice · Paper money" (violet) or
 * "Mainnet · Real money" (blue), full label, upper right on every money surface. One tap opens the compact selector
 * (`/network`), where entering Mainnet takes the deliberate "Switch to real money" (which locks the session).
 * `compact` drops the second half for the ticket header, where the money word already sits beside the amount.
 */
export function ModeCapsule({ compact = false }: { compact?: boolean }) {
  const network = useNetwork();
  const { color } = useTheme();
  const practice = network.key === "testnet";
  const tone = practice ? color.practice : color.mainnet;
  const mode = practice ? "Practice" : "Mainnet";
  const money = practice ? "Paper money" : "Real money";
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(ROUTES.network);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${mode}, ${money.toLowerCase()}. Change`}
      accessibilityHint="Opens the Practice and Mainnet selector"
      hitSlop={compact ? SPACE.sm : SPACE.none}
      style={({ pressed }) => [
        styles.capsule,
        { height: compact ? SIZE.chipHeight : SIZE.modeCapsuleHeight },
        { borderColor: tone, backgroundColor: practice ? color.practiceSurface : color.mainnetSurface },
        pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[TYPE.modeLabel, { color: tone }]} numberOfLines={1}>
        {compact ? mode : `${mode} · ${money}`}
      </Text>
    </Pressable>
  );
}

const PRESSED_OPACITY = 0.8;

const styles = StyleSheet.create({
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    flexShrink: 0,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
