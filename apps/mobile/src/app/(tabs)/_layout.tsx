import { DOCK_NAV } from "@senryo/config";
import type { Href } from "expo-router";
import { TabList, TabSlot, type TabSlotProps, Tabs, TabTrigger } from "expo-router/ui";
import { Activity, type ReactNode, useEffect, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import { Screen } from "react-native-screens";
import { Dock } from "~/components/shell/Dock";
import { DockProvider } from "~/components/shell/dock-context";
import { useTheme } from "~/theme";

/** The five dock destinations, each a retained stack (D-193): visited routes keep their scroll and history. */
export default function TabsLayout() {
  return (
    <DockProvider>
      <Tabs>
        <Shell />
        <TabList style={styles.hidden}>
          {DOCK_NAV.map((tab) => (
            <TabTrigger key={tab.key} name={tab.key} href={tab.path as Href} />
          ))}
        </TabList>
      </Tabs>
    </DockProvider>
  );
}

/** After launch settles, the tabs not yet visited mount this far apart, so none waits for its first tap (R5.24). */
const WARM_START_MS = 1_200;
const WARM_GAP_MS = 400;

/**
 * Which tabs have been mounted ahead of a visit: after launch and its interactions, one tab at a time in idle time
 * (the first tap on a dock tab used to wait 0.5–2.5 s for its screen to mount, R2's simulator pass).
 */
function useWarmTabs(): ReadonlySet<string> {
  const [warm, setWarm] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const task = InteractionManager.runAfterInteractions(() => {
      DOCK_NAV.forEach((tab, i) => {
        timers.push(setTimeout(() => setWarm((was) => new Set([...was, tab.key])), WARM_START_MS + i * WARM_GAP_MS));
      });
    });
    return () => {
      task.cancel();
      for (const t of timers) clearTimeout(t);
    };
  }, []);
  return warm;
}

/**
 * A tab's screen behind React's Activity (R5.24): shown while focused; otherwise hidden, its Effects torn down — live
 * rows, the chart's frame loop, timers — and its state kept. A warmed tab mounts shown once (at normal priority: a hidden
 * first render waits for idle time that live ticks never leave) and hides straight after. (`freezeOnBlur` re-hid the
 * whole tree on every tick a frozen row received.)
 */
function TabActivity({ focused, children }: { focused: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(focused);
  useEffect(() => setMounted(true), []);
  return <Activity mode={focused || !mounted ? "visible" : "hidden"}>{children}</Activity>;
}

/** Slot, dock and fan share the tabs' navigator context (the dock reads which tab is focused). */
function Shell() {
  const { color } = useTheme();
  const warm = useWarmTabs();
  // A tab renders once visited or warmed; a hidden one rests behind its Activity.
  const renderFn: NonNullable<TabSlotProps["renderFn"]> = (
    descriptor,
    { isFocused, loaded, detachInactiveScreens },
  ) => {
    if (!loaded && !isFocused && !warm.has(descriptor.route.name)) return null;
    return (
      <Screen
        key={descriptor.route.key}
        enabled={detachInactiveScreens}
        activityState={isFocused ? 2 : 0}
        style={[styles.screen, isFocused ? styles.focused : styles.unfocused]}
      >
        <TabActivity focused={isFocused}>{descriptor.render()}</TabActivity>
      </Screen>
    );
  };
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <TabSlot renderFn={renderFn} />
      <Dock />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
  // expo-router's own slot styles (`defaultTabsSlotRender`): the focused screen on top, the rest out of layout.
  screen: { flex: 1, position: "relative", height: "100%" },
  focused: { zIndex: 1, display: "flex", flexShrink: 0, flexGrow: 1 },
  unfocused: { zIndex: -1, display: "none", flexShrink: 1, flexGrow: 0 },
});
