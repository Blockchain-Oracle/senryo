import { ids } from "@senryo/identity";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChevronDown } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The persistent mode control (S8.22 → Living Lacquer §5.6, FT044; Codex consult 1 Oct): "Practice · Paper money"
 * (violet) or "Mainnet · Real money" (blue), full label, upper right on every money surface — a 34 pt borderless plate
 * in the mode's wash with a chevron, because it opens a selector (`/network`), where entering Mainnet takes the
 * deliberate "Switch to real money" (which locks the session). `compact` drops the second half for the ticket header,
 * where the money word already sits beside the amount.
 */
export function ModeCapsule({ compact = false }: { compact?: boolean }) {
  const network = useNetwork();
  const { color } = useTheme();
  const practice = network.key === "testnet";
  const tone = practice ? color.practice : color.mainnet;
  const mode = practice ? "Practice" : "Mainnet";
  const money = practice ? "Paper money" : "Real money";
  const press = usePressScale();
  return (
    <Animated.View style={[styles.shrink, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(ROUTES.network);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${mode}, ${money.toLowerCase()}. Change`}
        accessibilityHint="Opens the Practice and Mainnet selector"
        hitSlop={(SIZE.touch - (compact ? SIZE.chipHeight : SIZE.modeCapsuleHeight)) / 2}
        style={[
          styles.capsule,
          { height: compact ? SIZE.chipHeight : SIZE.modeCapsuleHeight },
          { backgroundColor: practice ? color.practiceSurface : color.mainnetSurface },
        ]}
      >
        <EntityMark id={ids.evmChain(network.chainId)} size={SIZE.iconSm} decorative />
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.modeLabel, { color: tone }]} numberOfLines={1}>
          {mode}
        </Text>
        <ChevronDown size={CHEVRON} strokeWidth={SIZE.iconStroke} color={tone} />
      </Pressable>
    </Animated.View>
  );
}

const CHEVRON = SPACE.md + SPACE.xxs;

const styles = StyleSheet.create({
  shrink: { flexShrink: 0 },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + SPACE.xxs,
    borderRadius: BUTTON.radius.md,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.sm,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
