import { type Href, router, useLocalSearchParams, usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { ROUTES, socialPeopleRoute } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useDock } from "./dock-context";

const MONEY = [
  { label: "Home", href: ROUTES.home },
  { label: "Card", href: ROUTES.card },
  { label: "Activity", href: ROUTES.activity },
  { label: "Pool", href: ROUTES.lp },
  { label: "Profile", href: ROUTES.you },
];
const TRADE = [
  { label: "Pairs", href: "/markets?view=perps" },
  { label: "Predict", href: "/markets?view=predict" },
  { label: "Watchlist", href: "/markets?view=watchlist" },
  { label: "Orders", href: ROUTES.orders },
  { label: "Profile", href: ROUTES.you },
];
const SOCIAL = [
  { label: "Feed", href: ROUTES.social },
  { label: "People", href: socialPeopleRoute },
  { label: "Profile", href: ROUTES.you },
];

/** Reference-sized text tabs; scroll instead of compressing labels at large Dynamic Type. */
export function ContextTabs() {
  const { color } = useTheme();
  const { context } = useDock();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ view?: string }>();
  const options = context === "trade" ? TRADE : context === "social" ? SOCIAL : MONEY;
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
    >
      <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={`${context} sections`}>
        {options.map((option) => {
          const [path, query] = option.href.split("?");
          const selected = pathname === path && (!query || query === `view=${params.view ?? "perps"}`);
          return (
            <Pressable
              key={option.label}
              onPress={() => {
                if (!selected) {
                  fire("tick");
                  router.navigate(option.href as Href);
                }
              }}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              style={styles.tab}
            >
              <Text style={[TYPE.buttonCompact, { color: selected ? color.ink : color.text3 }]}>{option.label}</Text>
              <View style={[styles.underline, { backgroundColor: selected ? color.ink : color.transparent }]} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { paddingHorizontal: SIZE.gutter, flexGrow: 1 },
  row: { flexDirection: "row", gap: SPACE.lg, alignItems: "center" },
  tab: { minHeight: SIZE.touch, justifyContent: "center" },
  underline: { height: 2, position: "absolute", bottom: SPACE.sm, left: 0, right: 0 },
});
