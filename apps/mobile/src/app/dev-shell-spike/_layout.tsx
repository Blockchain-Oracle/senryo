import { Navigator, Redirect, Stack } from "expo-router";
import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { StyleSheet, View } from "react-native";
import { Dock, triggerHref } from "~/features/shell-spike/Dock";
import { DockProvider } from "~/features/shell-spike/dock-context";
import { ProbeRunner } from "~/features/shell-spike/ProbeRunner";
import { SPIKE_TABS } from "~/features/shell-spike/screens";
import { useTheme } from "~/theme";

/**
 * S1b.7 navigation-shell spike (D-193) — dev-only and never linked from the app. It exists only in development builds
 * or when bundled with EXPO_PUBLIC_SHELL_SPIKE=1; everything else is redirected home. Five tabs on `expo-router/ui`
 * headless tabs, each its own stack, under the C15 floating dock. Open `senryo:///dev-shell-spike/home?probe=1` to run
 * the on-screen checks.
 */
const ENABLED = __DEV__ || process.env.EXPO_PUBLIC_SHELL_SPIKE === "1";

export default function ShellSpikeLayout() {
  if (!ENABLED) return <Redirect href="/" />;
  return (
    <DockProvider>
      {/* Hide the root stack's header for this route without touching the shared root layout. */}
      <Stack.Screen options={{ headerShown: false }} />
      <Tabs options={{ backBehavior: "history" }}>
        <SpikeShell />
        <TabList style={styles.hidden}>
          {SPIKE_TABS.map((tab) => (
            <TabTrigger key={tab} name={tab} href={triggerHref(tab)} />
          ))}
        </TabList>
      </Tabs>
    </DockProvider>
  );
}

/** Slot + dock + probe share the tabs' navigator context (the dock reads which tab is focused). */
function SpikeShell() {
  const { color } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <TabSlot />
      <FocusedDock />
      <ProbeRunner />
    </View>
  );
}

/** The headless tabs' navigator context (the same one TabSlot reads) gives the focused tab for the active region. */
function FocusedDock() {
  const { state } = Navigator.useContext();
  // Match by route name: the router's route order need not follow the dock's order.
  const name = state.routes[state.index]?.name;
  return (
    <Dock
      focused={Math.max(
        0,
        SPIKE_TABS.findIndex((tab) => tab === name),
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});
