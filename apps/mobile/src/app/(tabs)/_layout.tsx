import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ICONS } from "~/components/kit/icons";
import { PositionsAccessory } from "~/components/shell/PositionsAccessory";
import { useTheme } from "~/theme";

const TABS = [
  { name: "portfolio", label: "Portfolio", icon: ICONS.portfolio },
  { name: "markets", label: "Markets", icon: ICONS.markets },
  { name: "trade", label: "Trade", icon: ICONS.trade },
  { name: "card", label: "Card", icon: ICONS.card },
  { name: "fund", label: "Fund", icon: ICONS.fund },
] as const;

/**
 * NativeTabs (D-012): the real UITabBar / Material bar. On iOS 26 the system draws it in Liquid Glass and ignores the
 * background props; on iOS 18–25 and Android `backgroundColor` gives the solid D2 fallback, and
 * `disableTransparentOnScrollEdge` keeps it solid at the scroll edge. The open-positions mini-bar rides in the
 * BottomAccessory (iOS 26).
 */
export default function TabsLayout() {
  const { color } = useTheme();
  return (
    <NativeTabs
      backgroundColor={color.ground}
      tintColor={color.primary}
      indicatorColor={color.muted}
      labelStyle={{ default: { color: color.inkMuted }, selected: { color: color.ink } }}
      badgeBackgroundColor={color.primary}
    >
      <NativeTabs.BottomAccessory>
        <PositionsAccessory />
      </NativeTabs.BottomAccessory>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name} disableTransparentOnScrollEdge>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: tab.icon.sf, selected: tab.icon.sfSelected }} md={tab.icon.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
