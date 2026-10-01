import type { Address } from "@senryo/core";
import { isTerminalStage } from "@senryo/core";
import { useAccountRisk, useEquityHistory, useNetFlows, useStarterStatus } from "@senryo/query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { EquityChart } from "~/components/charts/EquityChart";
import { PeriodChips } from "~/components/kit/PeriodChips";
import { ReadingView, Skeleton } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { AlertsButton } from "~/components/shell/Utilities";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { SessionChip } from "~/features/auth/SessionChip";
import { Availability } from "~/features/home/Availability";
import { GuestHome } from "~/features/home/GuestHome";
import { CompactBalance, ExpandedBalance, HomeSeal } from "~/features/home/HomeHeader";
import { AvailabilitySkeleton } from "~/features/home/HomeParts";
import { HomeTiles } from "~/features/home/HomeTiles";
import { PositionsSection } from "~/features/home/PositionsSection";
import { TopTrades } from "~/features/home/TopTrades";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { useAccountRetry } from "~/features/portfolio/account";
import { MS_PER_SECOND, WINDOW_SEC } from "~/features/portfolio/constants";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { RiskBanner } from "~/features/portfolio/RiskBanner";
import { TokenHoldings } from "~/features/tokens/TokenHoldings";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useReadOnlyNetwork } from "~/lib/network";
import { SIZE, SPACE } from "~/theme";

const TIMEFRAMES = [
  { value: "1H", label: "1H" },
  { value: "24H", label: "24H" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "ALL", label: "All" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["value"];

/**
 * Home (J6, S1b.10; Fomo F09 / F12 / F16, direction §7): the collapsing header — seal, the balance with its 24 h
 * change and Add money, mode — then one account view in the direction's order: balance (its curve and period chips)
 * → Free to trade / Free to spend / Locked → positions → Kinpaku and the LP vault → Weekly Top Trades. The starter
 * claim and the risk notices sit above it when there is something to do. Everything is bare on the page or a filled
 * plate one step lighter than it; nothing is boxed. Mainnet before launch shows live prices read-only (S8.22).
 * `?open=add-money` (an old `/fund` link) opens the add-money hub over Home.
 */
export default function Home() {
  const readOnly = useReadOnlyNetwork();
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
      utilities={<AlertsButton />}
      status={<SessionChip />}
      expanded={readOnly ? null : <ExpandedBalance />}
    >
      {readOnly ? (
        <>
          <TokenHoldings />
          <PrelaunchMainnet surface="portfolio" />
        </>
      ) : (
        <HomeBody />
      )}
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
      <BalanceCurve address={address} />
      <AvailabilitySection address={address} />
      <PositionsSection />
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
function BalanceCurve({ address }: { address: Address }) {
  const [frame, setFrame] = useState<Timeframe>("24H");
  const curve = useEquityHistory(address, WINDOW_SEC[frame]);
  const retry = useAccountRetry();
  const known = curve.status === "fresh" || curve.status === "stale" ? curve.value : undefined;
  const flows = useNetFlows(address, known?.[0]?.timestamp);
  const moved = flows.status === "fresh" || flows.status === "stale" ? flows.value.net : undefined;
  const first = known?.[0]?.equityInit;
  const last = known?.at(-1)?.equityInit;
  const tone =
    first !== undefined && last !== undefined && moved !== undefined && last - first - moved < 0n ? "down" : "up";
  return (
    <View style={styles.stack}>
      {curve.status === "unknown" ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading balance history">
          <Skeleton height={SIZE.chartEquity} />
        </View>
      ) : (
        <ReadingView reading={curve} retry={retry}>
          {(points) =>
            points.length < 2 ? (
              <QuietLine>The chart starts with your first deposit or trade.</QuietLine>
            ) : (
              <EquityChart
                points={points.map((p) => ({ t: p.timestamp * MS_PER_SECOND, equity6: p.equityInit }))}
                tone={tone}
              />
            )
          }
        </ReadingView>
      )}
      <View style={styles.periods}>
        <PeriodChips options={TIMEFRAMES} value={frame} onChange={setFrame} label="Chart period" />
      </View>
    </View>
  );
}

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
