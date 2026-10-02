import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * A pushed page's own header (Fomo F32): one fixed row under the status bar — a quiet back chevron, then whatever
 * names the page (a market's mark, symbol and name; a plain title), then its controls at the right. The native header
 * is hidden on these pages so the identity can sit in the bar as it does in the reference; the edge swipe and system
 * back still work. 56 pt high like every bar in the shell.
 */
export function PageHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: color.ground }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            fire("tick");
            // Opened cold from a link with nothing under it: back lands on the Markets tab, never on nothing.
            if (router.canGoBack()) router.back();
            else router.replace(ROUTES.markets);
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={SPACE.md}
          style={({ pressed }) => [styles.back, { opacity: pressed ? PRESSED : 1 }]}
        >
          <ChevronLeft size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text3} />
        </Pressable>
        <View style={styles.middle}>{children}</View>
        {right}
      </View>
    </View>
  );
}

/** A plain page title in the bar (Search, a market that isn't listed). */
export function PageTitle({ children }: { children: string }) {
  const { color } = useTheme();
  return (
    <Text accessibilityRole="header" numberOfLines={1} style={[TYPE.sectionTitle, { color: color.ink }]}>
      {children}
    </Text>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  row: {
    minHeight: SIZE.touch + SPACE.md,
    paddingHorizontal: SIZE.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  /** The chevron's box is pulled left so the glyph's stroke, not its box, sits on the gutter (F32). */
  back: { width: SIZE.icon, height: SIZE.touch, justifyContent: "center", marginLeft: -SPACE.xs },
  middle: { flex: 1, minWidth: 0 },
});
