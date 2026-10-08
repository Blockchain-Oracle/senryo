import { ids } from "@senryo/identity";
import { useTabTrigger } from "expo-router/ui";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Wallet } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { dockBottom, EASE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { TABS, type TabName } from "./constants";
import { type ShellContext, useDock } from "./dock-context";

const DOCK_HIDDEN_OFFSET = 120;

/** Retain every registered stack; the visible dock groups them into two contexts until S5 (D-268). */
export function useFocusedTab(): TabName {
  const { getTrigger } = useTabTrigger({ name: TABS[0] });
  return TABS.find((tab) => getTrigger(tab)?.isFocused) ?? TABS[0];
}

export function Dock() {
  const { color } = useTheme();
  const { hidden, context, setContext } = useDock();
  const { switchTab } = useTabTrigger({ name: "home" });
  const focused = useFocusedTab();
  const [typing, setTyping] = useState(false);
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const shown = !hidden && !typing;
  const offset = useSharedValue(shown ? 0 : DOCK_HIDDEN_OFFSET);
  useEffect(() => {
    if (focused === "you") return; // Profile keeps the context it was opened from.
    setContext(focused === "markets" ? "trade" : "money");
  }, [focused, setContext]);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setTyping(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    offset.value = withTiming(shown ? 0 : DOCK_HIDDEN_OFFSET, {
      duration: reduce ? 0 : TIMING.selection,
      easing: EASE,
    });
  }, [shown, reduce, offset]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const select = (next: ShellContext) => {
    if (next !== context) fire("tick");
    setContext(next);
    switchTab(next === "money" ? "home" : "markets", {});
  };
  return (
    <Animated.View
      pointerEvents={shown ? "box-none" : "none"}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
      style={[styles.position, { bottom: dockBottom(insets.bottom), opacity: shown ? 1 : 0 }, motion]}
    >
      <View
        style={[styles.rail, { backgroundColor: color.glassOpaque }]}
        accessibilityRole="tablist"
        accessibilityLabel="App context"
      >
        <Pressable
          onPress={() => select("trade")}
          accessibilityRole="tab"
          accessibilityLabel="Trade"
          accessibilityState={{ selected: context === "trade" }}
          style={[styles.anchor, { backgroundColor: color.action, boxShadow: `0px 0px 18px 0px ${color.glow}` }]}
        >
          <EntityMark id={ids.brand("senryo")} size={52} variant="symbol" decorative ground={color.action} />
        </Pressable>
        <Pressable
          onPress={() => select("money")}
          accessibilityRole="tab"
          accessibilityLabel="Money"
          accessibilityState={{ selected: context === "money" }}
          style={styles.side}
        >
          <Wallet size={24} color={context === "money" ? color.ink : color.text3} />
          <Text style={[TYPE.micro, { color: context === "money" ? color.ink : color.text3 }]}>Money</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  position: { position: "absolute", alignSelf: "center" },
  rail: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 40,
    minHeight: 60,
    paddingHorizontal: SPACE.sm,
    gap: SPACE.sm,
  },
  side: { minWidth: 62, minHeight: SIZE.touch, alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  anchor: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -SPACE.sm,
  },
});
