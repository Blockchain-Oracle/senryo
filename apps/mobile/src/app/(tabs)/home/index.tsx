import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { ActivityButton } from "~/components/shell/Utilities";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { GuestHome } from "~/features/home/GuestHome";
import { HomeGroups } from "~/features/home/HomeGroups";
import { CompactBalance, ExpandedBalance, HomeSeal } from "~/features/home/HomeHeader";
import { TopTrades } from "~/features/home/TopTrades";
import { NotificationsBell } from "~/features/notifications/NotificationsBell";
import { RiskBanner } from "~/features/portfolio/RiskBanner";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE } from "~/theme";

/** Personal money first: Slush balance/actions and account/investment groups; Fomo Top Trades below. */
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
      <HomeGroups />
      <TopTrades />
    </>
  );
}
