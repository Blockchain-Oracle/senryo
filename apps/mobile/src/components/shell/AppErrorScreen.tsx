/**
 * What the app shows instead of crashing (D0): the root layout's error boundary. A render error used to end a Release
 * build outright; now the error is kept for the next launch's report (`recordError`) and the screen offers Try again,
 * then a full restart. It renders above the layout's providers, so it reads the palette tokens and the stored theme
 * directly.
 */
import { DARK, LIGHT } from "@senryo/tokens";
import type { ErrorBoundaryProps } from "expo-router";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { recordError } from "~/lib/crash/report";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { RADIUS, SIZE, SPACE, TYPE } from "~/theme";

export function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => recordError(error, "boundary", false), [error]);
  const system = useColorScheme();
  const stored = storage.getString(STORAGE_KEYS.theme);
  const p = (stored === "dark" || stored === "light" ? stored : system) === "light" ? LIGHT : DARK;
  return (
    <View style={[styles.fill, { backgroundColor: p.background }]} accessibilityRole="alert">
      <Text style={[TYPE.title, { color: p.foreground }]}>Something broke</Text>
      <Text style={[TYPE.body, styles.line, { color: p.text2 }]}>
        It's been noted for a fix. Your dollars and positions are where you left them.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={[styles.button, { backgroundColor: p.foreground }]}
      >
        <Text style={[TYPE.buttonLabel, { color: p.background }]}>Try again</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void Updates.reloadAsync()} hitSlop={SPACE.sm}>
        <Text style={[TYPE.rowTitle, { color: p.text2 }]}>Restart the app</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.lg, paddingHorizontal: SIZE.gutter },
  line: { textAlign: "center" },
  button: {
    minHeight: SIZE.touch,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.pill,
  },
});
