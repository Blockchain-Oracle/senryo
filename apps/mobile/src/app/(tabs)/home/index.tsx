import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { ActivityButton } from "~/components/shell/Utilities";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { GuestHome } from "~/features/home/GuestHome";
import { CompactBalance, ExpandedBalance, HomeSeal } from "~/features/home/HomeHeader";
import { HomeTabs } from "~/features/home/HomeTabs";
import { TopTrades } from "~/features/home/TopTrades";
import { NotificationsBell } from "~/features/notifications/NotificationsBell";
import { RiskBanner } from "~/features/portfolio/RiskBanner";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE } from "~/theme";

/**
 * Home (flow book §0.9 Home; Fomo F09/F12/F16): the collapsing header — seal, Activity and Notifications, the mode
 * pill — then the Total (it rolls, ≈ + ⓘ when partial; tap for what makes it up) with Add money / Withdraw under it.
 * Below: Weekly Top Trades, then Positions · Assets · Earn as tabs. No session pill (Face ID asks at the action), no
 * availability grid (buying power lives in the ticket, spendable on the Card tab), no portfolio chart. The starter
 * claim and liquidation notices sit above the tabs only when there is something to do. `?open=add-money` (an old
 * `/fund` link) opens the add-money hub over Home.
 */
export default function Home() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  useEffect(() => {
    if (open !== "add-money") return;
    router.setParams({ open: undefined });
    router.push(ROUTES.addMoney);
  }, [open]);
  return (
    <CollapsingScreen
      left={<HomeSeal />}
      compact={<CompactBalance />}
      utilities={
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          <ActivityButton />
          <NotificationsBell />
        </View>
      }
      expanded={<ExpandedBalance />}
    >
      <HomeBody />
    </CollapsingScreen>
  );
}

function HomeBody() {
  const address = useAccount().hint?.address;
  if (!address) return <GuestHome />;
  return (
    <>
      <AccountStrip />
      <RiskBanner />
      <TopTrades />
      <HomeTabs />
    </>
  );
}
