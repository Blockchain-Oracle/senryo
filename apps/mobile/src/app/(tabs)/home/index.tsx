import type { Address } from "@senryo/core";
import { isTerminalStage } from "@senryo/core";
import { useAccountRisk, useStarterStatus } from "@senryo/query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { ReadingView } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { ActivityButton, AlertsButton } from "~/components/shell/Utilities";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { SessionChip } from "~/features/auth/SessionChip";
import { Availability } from "~/features/home/Availability";
import { GuestHome } from "~/features/home/GuestHome";
import { CompactBalance, ExpandedBalance, HomeSeal } from "~/features/home/HomeHeader";
import { AvailabilitySkeleton } from "~/features/home/HomeParts";
import { HomeTiles } from "~/features/home/HomeTiles";
import { PositionsSection } from "~/features/home/PositionsSection";
import { TopTrades } from "~/features/home/TopTrades";
import { useAccountRetry } from "~/features/portfolio/account";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { RiskBanner } from "~/features/portfolio/RiskBanner";
import { TokenHoldings } from "~/features/tokens/TokenHoldings";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useReadOnlyNetwork } from "~/lib/network";
import { SPACE } from "~/theme";

/**
 * Home (J6, S1b.10; Fomo F09 / F12 / F16, direction §7): the collapsing header — seal, the balance with its 24 h
 * change and Add money, mode — then one account view in the direction's order: balance (its curve and period chips)
 * → Free to trade / Free to spend / Locked → positions → Kinpaku and the LP vault → Weekly Top Trades. The starter
 * claim and the risk notices sit above it when there is something to do. Everything is bare on the page or a filled
 * plate one step lighter than it; nothing is boxed. Mainnet before launch shows live prices read-only (S8.22).
 * `?open=add-money` (an old `/fund` link) opens the add-money hub over Home.
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
          <AlertsButton />
        </View>
      }
      status={<SessionChip />}
      expanded={<ExpandedBalance />}
    >
      <HomeBody />
    </CollapsingScreen>
  );
}

function HomeBody() {
  const address = useAccount().hint?.address;
  const readOnly = useReadOnlyNetwork();
  if (!address) return <GuestHome />;
  return (
    <>
      <AccountStrip />
      {readOnly ? (
        <QuietLine>Mainnet trading is not available yet. Wallet actions are available from Add money.</QuietLine>
      ) : (
        <>
          <RiskBanner />
          <AvailabilitySection address={address} />
          <PositionsSection />
        </>
      )}
      <TokenHoldings />
      <HomeTiles />
      <TopTrades />
    </>
  );
}

/**
 * The balance's curve under the header (F16): the chart bare on the page with its period chips right-aligned under
 * it. The chips stay put while a window loads, so switching period never moves them. The curve's colour is how the
 * window went net of money moved in or out (the header's rule): a send or a withdrawal draws a drop, not a red loss.
 */

/**
 * The three capacities, or — for an account that holds nothing yet — one quiet line saying what happens next. A
 * claim in flight (or finalized onchain but not yet in the finalized read) is not "nothing here" (S8.16e). Add money
 * is already beside the balance, so the line carries no second action.
 */
function AvailabilitySection({ address }: { address: Address }) {
  const risk = useAccountRisk(address, "finalized");
  const starterStatus = useStarterStatus(address);
  const retry = useAccountRetry();
  const lastRelay = starterStatus.data?.lastRelay;
  const arriving =
    starterStatus.data?.claimed === true || (lastRelay?.kind === "claim" && !isTerminalStage(lastRelay.stage));
  if (risk.status === "unknown") return <AvailabilitySkeleton />;
  return (
    <View style={styles.stack}>
      <ReadingView reading={risk} retry={retry}>
        {(s) =>
          s.equityInit === 0n && s.positionBitmap === 0 ? (
            <QuietLine>
              {arriving
                ? "Your practice dollars are arriving · the claim is settling onchain, and your balance appears here in a moment."
                : "Nothing here yet · claim practice funds or deposit from any chain, then open your first position."}
            </QuietLine>
          ) : (
            <Availability snapshot={s} />
          )
        }
      </ReadingView>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.sm },
  periods: { alignItems: "flex-end" },
});
