import { onlineManager } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassPlate } from "~/components/kit/GlassPlate";
import { Icon } from "~/components/kit/Icon";
import { fire } from "~/feedback/fire";
import { DIAGNOSIS_COPY } from "~/lib/copy/diagnosis";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * F62 offline: a floating banner while the device has no internet. Cached data stays on screen marked stale (never
 * "failed"); TanStack Query pauses fetches through `onlineManager` and refetches on reconnect (reconcile).
 */
export function OfflineBanner() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  // Unknown (null/undefined) counts as online: never flash an offline banner before the first reading.
  const offline = network.isInternetReachable === false || network.isConnected === false;
  const was = useRef(offline);
  useEffect(() => {
    onlineManager.setOnline(!offline);
    if (offline && !was.current) fire("warn");
    was.current = offline;
  }, [offline]);
  if (!offline) return null;
  const copy = DIAGNOSIS_COPY.offline;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + SIZE.strip + SPACE.sm }]}>
      <GlassPlate style={styles.plate}>
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.row}>
          <Icon name="offline" size={SIZE.iconSm} tint={color.warn} />
          <View style={styles.copy}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{copy.headline}</Text>
            <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{copy.body}</Text>
          </View>
        </View>
      </GlassPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: SIZE.gutter, right: SIZE.gutter },
  plate: { borderRadius: SHEET_SHAPE.rowRadius, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md },
  copy: { flex: 1, gap: SPACE.xxs },
});
