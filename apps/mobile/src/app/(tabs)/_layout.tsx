import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { StyleSheet, View } from "react-native";
import { TAB_HREF, TABS } from "~/components/shell/constants";
import { Dock } from "~/components/shell/Dock";
import { DockProvider } from "~/components/shell/dock-context";
import { useTheme } from "~/theme";

/** Three visible contexts over five retained stacks. Visited routes keep their scroll and history.
 * Money operations now use a contextual method sheet; no competing fan remains.
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
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <TabSlot />
      <Dock />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});
