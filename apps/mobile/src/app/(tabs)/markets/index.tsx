import { router } from "expo-router";
import { Search, Star } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ChipRow } from "~/components/kit/ChipRow";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { MarketsList, type MarketsView } from "~/features/markets/MarketsList";
import { MARKET_FILTERS, type MarketFilter } from "~/features/markets/universe";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { ROUTES } from "~/lib/constants/routes";
import { useReadOnlyNetwork } from "~/lib/network";
import { SIZE, SPACE, TIMING, useTheme } from "~/theme";

const VIEWS = [
  { value: "watchlist", label: "Watchlist", icon: Star },
  { value: "all", label: "All" },
] as const;

/**
 * Markets tab root (J3, S1b.9; Fomo F09–F12, direction §8): the title and mode stay in the fixed bar; under it pin the
 * Watchlist / All tabs with their sliding underline (F09) and the category chips, led by the search control where
 * F09 has its filter button. Search pushes its own page (F31); price alerts open from a market's header and from Home
 * and You. Browsable without an account (F03). Mainnet before launch shows live prices read-only (S8.22). A row opens
 * market detail on this stack; the ticket opens from there.
 */
export default function Markets() {
  const readOnly = useReadOnlyNetwork();
  const { color } = useTheme();
  const [view, setView] = useState<MarketsView>("all");
  const [filter, setFilter] = useState<MarketFilter>("all");
  return (
    <CollapsingScreen
      left={<TabTitle>Markets</TabTitle>}
      sticky={
        readOnly ? undefined : (
          <View style={styles.sticky}>
            <UnderlineTabs options={VIEWS} value={view} onChange={setView} label="Market list" />
            <ChipRow
              options={MARKET_FILTERS}
              value={filter}
              onChange={setFilter}
              label="Market category"
              leading={
                <UtilityButton label="Search markets and traders" onPress={() => router.push(ROUTES.marketSearch)}>
                  <Search size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
                </UtilityButton>
              }
            />
          </View>
        )
      }
    >
      {readOnly ? (
        <PrelaunchMainnet surface="markets" />
      ) : (
        // The list of the chosen tab arrives with a short fade instead of snapping in under the moving underline.
        <Animated.View key={view} entering={FadeIn.duration(TIMING.selection)} style={styles.list}>
          <MarketsList view={view} filter={filter} />
        </Animated.View>
      )}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  sticky: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  list: { gap: SPACE.xl },
});
