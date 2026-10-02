/**
 * A child panel inside the same compact sheet (Fomo F21: "Deposit crypto" with an explicit back over the method list,
 * M16): the panel slides in from the trailing edge going deeper and from the leading edge coming back, its heading
 * centred with a back chevron at the leading edge. Reduce Motion: a crossfade (Reanimated's system setting).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";
import { ChevronLeft } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { SHEET_SHAPE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

export function SheetPanel({
  panelKey,
  direction,
  children,
}: {
  /** Changing it slides the new panel in. */
  panelKey: string;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  const entering = (direction === "forward" ? SlideInRight : SlideInLeft).duration(TIMING.parentChild);
  return (
    <Animated.View key={panelKey} entering={entering} style={styles.panel}>
      {children}
    </Animated.View>
  );
}

/** The panel's heading: back chevron, centred title, one short line under it. */
export function PanelHeading({ title, body, onBack }: { title: string; body?: string; onBack?: () => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.head}>
      {onBack ? (
        <Pressable
          onPress={() => {
            fire("tick");
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={SPACE.sm}
          style={styles.back}
        >
          <ChevronLeft size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
          {title}
        </Text>
        {body ? <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>{body}</Text> : null}
      </View>
      <View style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: SHEET_SHAPE.rowGap },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingBottom: SPACE.xs },
  back: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1, gap: SPACE.xxs },
  center: { textAlign: "center" },
});
