/**
 * The inbox's one line about push on this phone (G1 states): off and never asked → "Notifications off" · Turn on (the
 * channels page asks and registers); refused → "Off in Settings" · Open Settings; a build without the module →
 * "Update Senryo for notifications". Nothing when push is on. Re-read on every focus (Settings is the usual way back).
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ROUTES } from "~/lib/constants/routes";
import { type PushPermission, readPushPermission } from "~/lib/notifications/push";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

export function PushBanner() {
  const { color } = useTheme();
  const [permission, setPermission] = useState<PushPermission>();
  useFocusEffect(
    useCallback(() => {
      void readPushPermission().then(setPermission);
    }, []),
  );
  if (permission === undefined || permission === "granted") return null;
  const line =
    permission === "denied"
      ? "Off in Settings"
      : permission === "unavailable"
        ? "Update Senryo for notifications"
        : "Notifications off";
  return (
    <View style={[styles.banner, { backgroundColor: color.raised2 }]}>
      <Text style={[TYPE.rowTitle, styles.text, { color: color.ink }]}>{line}</Text>
      {permission === "denied" ? (
        <Button label="Open Settings" size="sm" block={false} onPress={() => void Linking.openSettings()} />
      ) : permission === "undetermined" ? (
        <Button label="Turn on" size="sm" block={false} onPress={() => router.push(ROUTES.accountNotifications)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
  },
  text: { flex: 1 },
});
