import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SHEET_SHAPE, SPACE, TYPE, useTheme } from "~/theme";
import { Sheet } from "./Sheet";

/**
 * A sheet's heading (Fomo F20/F36): the title centred under the handle, one centred sentence under it. No close
 * button: the handle, the scrim and Back dismiss it, and the scrim carries the accessible "Close" name.
 */
export function SheetHeading({ title, body }: { title: string; body?: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
        {title}
      </Text>
      {body ? <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{body}</Text> : null}
    </View>
  );
}

/** A sheet route (transparent modal) with the standard heading; `router.back()` once it has slid away. */
export function SheetRoute({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <Sheet onClose={() => router.back()} closeLabel={`Close ${title}`}>
      <SheetHeading title={title} {...(body ? { body } : {})} />
      {children ? <View style={styles.rows}>{children}</View> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { gap: SPACE.xs, paddingHorizontal: SPACE.sm },
  center: { textAlign: "center" },
  rows: { gap: SHEET_SHAPE.rowGap },
});
