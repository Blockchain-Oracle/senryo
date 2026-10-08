import { DOCK_NAV } from "@senryo/config";
import type { Href } from "expo-router";
import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { StyleSheet, View } from "react-native";
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
