/**
 * The header bell (G1; §0.9 Home header "Notifications (bell, with an unread count badge, not a dot)"). Ported from
 * 21st.dev ruixen.ui/notification-button (id 7914): the round control with the bell and, at its upper right, a pill
 * with the count — hidden at zero, never a bare dot. Built on the shell's 36 pt utility disc; the count caps at "99+".
 * Opens the inbox. The count is read only while the session is unlocked (a badge never asks for Face ID).
 */
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Bell } from "~/components/kit/symbols";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { ROUTES } from "~/lib/constants/routes";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useBellCount } from "./useInbox";

const COUNT_CAP = 99;
const BADGE_HEIGHT = 18;
/** The badge sits this far outside the disc's upper-right corner (21st: -top-1 -right-1). */
const BADGE_OUTSET = -4;

export function NotificationsBell() {
  const { color } = useTheme();
  const count = useBellCount();
  const text = count === undefined ? undefined : count > COUNT_CAP ? `${COUNT_CAP}+` : String(count);
  return (
    <UtilityButton
      label={count ? `Notifications, ${count} unread` : "Notifications"}
      onPress={() => router.push(ROUTES.notifications)}
    >
      <Bell size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      {text ? (
        <View
          pointerEvents="none"
          style={[styles.badge, { backgroundColor: color.primary, borderColor: color.ground }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.micro, { color: color.primaryForeground }]}>
            {text}
          </Text>
        </View>
      ) : null}
    </UtilityButton>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: BADGE_OUTSET,
    right: BADGE_OUTSET,
    minWidth: BADGE_HEIGHT,
    height: BADGE_HEIGHT,
    paddingHorizontal: SPACE.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
