import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Bell, History } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { BUTTON, RADIUS, SIZE, useTheme } from "~/theme";

/** A round utility shrinks a little more than a button: it is small, so 0.97 would not be felt. */
const UTILITY_PRESS_SCALE = 0.94;
/** Lucide glyph inside the 36 pt disc. */
export const UTILITY_ICON = 20;

/**
 * A round utility control (Fomo F16's share / history / settings): a 36 pt filled disc with a 20 pt icon and a 44 pt
 * target. Utilities sit in a tab root's bar beside the mode control — there is no utility strip under the header.
 */
export function UtilityButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const press = usePressScale(UTILITY_PRESS_SCALE);
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={(SIZE.touch - BUTTON.utility) / 2}
        style={({ pressed }) => [styles.disc, { backgroundColor: pressed ? color.rowPressed : color.raised2 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Price alerts, wherever a tab offers them. */
export function AlertsButton() {
  const { color } = useTheme();
  return (
    <UtilityButton label="Alerts" onPress={() => router.push(ROUTES.alerts)}>
      <Bell size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
    </UtilityButton>
  );
}

export function ActivityButton() {
  const { color } = useTheme();
  return (
    <UtilityButton label="Activity" onPress={() => router.push(ROUTES.activity)}>
      <History size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
    </UtilityButton>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: BUTTON.utility,
    height: BUTTON.utility,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
