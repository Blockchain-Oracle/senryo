import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SessionChip } from "~/features/auth/SessionChip";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * The pinned utility row under every tab root's header (Codex S1b.7 consult #6): the trading-session chip on the
 * left (S6: lock state and the way to unlock), alerts on the right, plus any tab-specific utility (You: settings).
 * It keeps the retired D2 TopStrip's functions; the account icon became the You destination in the dock.
 */
export function UtilityRow({ children }: { children?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <SessionChip />
      <View style={styles.end}>
        {children}
        <UtilityButton label="Alerts" onPress={() => router.push(ROUTES.alerts)}>
          <Bell size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </UtilityButton>
      </View>
    </View>
  );
}

export function UtilityButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.tap}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: SIZE.touch,
    paddingHorizontal: SIZE.gutter,
    paddingBottom: SPACE.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  end: { marginLeft: "auto", flexDirection: "row", alignItems: "center" },
  tap: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
});
