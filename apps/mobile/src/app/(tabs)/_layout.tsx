import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { StyleSheet, View } from "react-native";
import { ActionFan } from "~/components/shell/ActionFan";
import { TAB_HREF, TABS } from "~/components/shell/constants";
import { Dock } from "~/components/shell/Dock";
import { DockProvider } from "~/components/shell/dock-context";
import { useFanActions } from "~/components/shell/useFanActions";
import { useTheme } from "~/theme";

/**
 * The Living Lacquer shell (S1b.7, D-176; spike D-193): five destinations Home · Markets · Card · Social · You on
 * `expo-router/ui` headless tabs, each its own stack. Visited tabs stay mounted, so stack and scroll survive switches.
 * Over the slot: the floating glass dock (C15) and the Phantom fan's plus (C18). The hidden `TabList` defines the
 * routes; the dock's triggers render outside it. NativeTabs is retired as the visual shell (D-176).
 */
export default function TabsLayout() {
  return (
    <DockProvider>
      <Tabs>
        <Shell />
        <TabList style={styles.hidden}>
          {TABS.map((tab) => (
            <TabTrigger key={tab} name={tab} href={TAB_HREF[tab]} />
          ))}
        </TabList>
      </Tabs>
    </DockProvider>
  );
}

/** Slot, dock and fan share the tabs' navigator context (the dock reads which tab is focused). */
function Shell() {
  const { color } = useTheme();
  const onAction = useFanActions();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <TabSlot />
      <Dock />
      <ActionFan onAction={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});
