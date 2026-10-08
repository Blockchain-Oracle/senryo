import { DOCK_NAV, type DockKey, type NavIcon } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useTabTrigger } from "expo-router/ui";
import { type ComponentType, useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChartLine, House, LayoutGrid, Receipt, type SymbolProps } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { dockBottom, EASE, SIZE, SPACE, TIMING, useTheme } from "~/theme";
import { TABS, type TabName } from "./constants";
import { useDock } from "./dock-context";

const DOCK_HIDDEN_OFFSET = 120;
const ICON = 24;
const SEAL = 52;
const SEAL_PLATE = 64;

const GLYPH: Partial<Record<NavIcon, ComponentType<SymbolProps>>> = {
  home: House,
  markets: ChartLine,
  calls: Receipt,
  more: LayoutGrid,
};

export function useFocusedTab(): TabName {
  const { getTrigger } = useTabTrigger({ name: TABS[0] ?? "home" });
  return TABS.find((tab) => getTrigger(tab)?.isFocused) ?? "home";
}

/**
 * The phone dock (D-268, Fomo look D-196): an icon-only glass rail — Home · Markets · [seal = Trade] · Calls · More —
 * from the shared navigation source. No labels on screen (VoiceOver reads them); the seal opens the terminal.
 */
export function Dock() {
  const { color } = useTheme();
  const { hidden } = useDock();
  const { switchTab } = useTabTrigger({ name: "home" });
  const focused = useFocusedTab();
  const [typing, setTyping] = useState(false);
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const shown = !hidden && !typing;
  const offset = useSharedValue(shown ? 0 : DOCK_HIDDEN_OFFSET);
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
  const go = (key: DockKey) => {
    if (key !== focused) fire("tick");
    switchTab(key, {});
  };
  return (
    <Animated.View
      pointerEvents={shown ? "box-none" : "none"}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
      style={[styles.position, { bottom: dockBottom(insets.bottom), opacity: shown ? 1 : 0 }, motion]}
    >
      <View style={[styles.rail, { backgroundColor: color.glassOpaque }]} accessibilityRole="tablist">
        {DOCK_NAV.map((item) =>
          item.icon === "seal" ? (
            <SealButton
              key={item.key}
              label={item.label}
              selected={focused === item.key}
              onPress={() => go(item.key)}
            />
          ) : (
            <DockButton
              key={item.key}
              label={item.label}
              icon={item.icon}
              selected={focused === item.key}
              onPress={() => go(item.key)}
            />
          ),
        )}
      </View>
    </Animated.View>
  );
}

function DockButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: NavIcon;
  selected: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const Glyph = GLYPH[icon];
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.side}
    >
      <Animated.View style={press.style}>
        {Glyph ? (
          <Glyph
            size={ICON}
            strokeWidth={SIZE.iconStroke}
            color={selected ? color.ink : color.text3}
            {...(selected ? { fill: color.ink } : {})}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function SealButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Animated.View
        style={[
          styles.seal,
          { backgroundColor: color.action, boxShadow: `0px 0px 18px 0px ${color.glow}` },
          press.style,
        ]}
      >
        <EntityMark id={ids.brand("senryo")} size={SEAL} variant="symbol" decorative ground={color.action} />
      </Animated.View>
    </Pressable>
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
    gap: SPACE.xs,
  },
  side: { width: SIZE.touch + SPACE.sm, minHeight: SIZE.touch, alignItems: "center", justifyContent: "center" },
  seal: {
    width: SEAL_PLATE,
    height: SEAL_PLATE,
    borderRadius: SEAL_PLATE / 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -SPACE.sm,
    marginHorizontal: SPACE.xs,
  },
});
