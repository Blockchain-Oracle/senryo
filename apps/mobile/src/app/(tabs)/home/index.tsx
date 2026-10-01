import { isTerminalStage } from "@senryo/core";
import { useAccountRisk, useEquityHistory, usePositions, useStarterStatus } from "@senryo/query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EquityChart } from "~/components/charts/EquityChart";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { AlertsButton } from "~/components/shell/Utilities";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { SessionChip } from "~/features/auth/SessionChip";
import { Availability } from "~/features/home/Availability";
import { GuestHome } from "~/features/home/GuestHome";
import { CompactBalance, ExpandedBalance, HomeSeal } from "~/features/home/HomeHeader";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { CollateralPanel } from "~/features/portfolio/CollateralPanel";
import { MS_PER_SECOND, WINDOW_SEC } from "~/features/portfolio/constants";
import { PositionsTable } from "~/features/portfolio/PositionsTable";
import { RiskBanner } from "~/features/portfolio/RiskBanner";
import { usePositionsSummary } from "~/features/portfolio/usePositionsSummary";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { pct, signedUsd } from "~/lib/money";
import { useReadOnlyNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

const TIMEFRAMES = [
  { value: "1H", label: "1H" },
  { value: "24H", label: "24H" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "ALL", label: "All" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["value"];

/**
 * Home (S1b.7 shell; J6 rebuilds the body in S1b.10): the collapsing header — seal, the risk-adjusted balance with
 * Add money, mode capsule — over today's Portfolio reads: starter claim, risk banner, equity chart, availability,
 * collateral and positions. Mainnet before launch shows live prices read-only (S8.22). `?open=add-money` (an old
 * `/fund` link) opens the add-money hub over Home.
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
      {readOnly ? <PrelaunchMainnet surface="portfolio" /> : <HomeBody />}
    </CollapsingScreen>
  );
}

function HomeBody() {
  const { color } = useTheme();
  const account = useAccount();
  const address = account.hint?.address;
  const [frame, setFrame] = useState<Timeframe>("24H");
  const risk = useAccountRisk(address, "finalized");
  const live = useAccountRisk(address, "latest");
  const curve = useEquityHistory(address, WINDOW_SEC[frame]);
  const positions = usePositions(address);
  const starterStatus = useStarterStatus(address);
  const lastRelay = starterStatus.data?.lastRelay;
  // A claim in flight (or finalized onchain but not yet in the finalized read) is not "nothing here" (S8.16e).
  const arriving =
    starterStatus.data?.claimed === true || (lastRelay?.kind === "claim" && !isTerminalStage(lastRelay.stage));

  if (!address) return <GuestHome />;

  return (
    <>
      <AccountStrip />
      <RiskBanner />
      <View style={styles.section}>
        <ReadingView reading={curve} loading="chart" loadingLabel="Loading balance history">
          {(points) =>
            points.length < 2 ? (
              <Text style={[TYPE.meta, { color: color.text3 }]}>
                The chart starts with your first deposit or trade.
              </Text>
            ) : (
              <EquityChart points={points.map((p) => ({ t: p.timestamp * MS_PER_SECOND, equity6: p.equityInit }))} />
            )
          }
        </ReadingView>
        <Segmented options={TIMEFRAMES} value={frame} onChange={setFrame} label="Chart timeframe" />
      </View>
      <ReadingView reading={risk} loading="plate" loadingLabel="Reading your balance">
        {(s) =>
          s.equityInit === 0n && s.positionBitmap === 0 ? (
            arriving ? (
              <EmptyState
                why="Your practice dollars are arriving"
                detail="The claim is settling onchain · your balance appears here in a moment."
              />
            ) : (
              <EmptyState
                why="Nothing here yet"
                detail="Claim practice funds or deposit from any chain, then open your first position."
                action={{ label: "Add money", onPress: () => router.push(ROUTES.addMoney) }}
              />
            )
          ) : (
            <>
              <Availability snapshot={s} />
              <CollateralPanel snapshot={s} />
            </>
          )
        }
      </ReadingView>
      <ReadingView reading={positions} loading="list" loadingLabel="Syncing positions">
        {(list) => (
          <View style={styles.section}>
            <PositionsHeading count={list.length} />
            {list.length === 0 ? (
              <EmptyState
                why="No open positions"
                detail="Every market trades at its live oracle price. Start small in practice mode."
                action={{ label: "Browse markets", onPress: () => router.navigate(ROUTES.markets) }}
              />
            ) : live.status === "fresh" || live.status === "stale" ? (
              <PositionsTable positions={list} account={live.value} />
            ) : null}
          </View>
        )}
      </ReadingView>
    </>
  );
}

/**
 * The positions heading carries what the retired NativeTabs mini-bar showed ("2 positions · +$115.80 · XAU liq 12%
 * away"): count, unrealised P&L at the conservative exit, and the position closest to liquidation.
 */
function PositionsHeading({ count }: { count: number }) {
  const { color } = useTheme();
  const summary = usePositionsSummary();
  const n = summary?.nearest;
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Positions · {count}
      </Text>
      {summary ? (
        <Text style={[TYPE.moneyMeta, { color: color.text2 }]} numberOfLines={1}>
          <Text style={{ color: summary.upnlUsd6 < 0n ? color.down : color.up }}>{signedUsd(summary.upnlUsd6)}</Text>
          {n ? (
            <Text style={{ color: color.warn }}>
              {" "}
              · {n.symbol} liq {n.distanceBps <= 0n ? "now" : `${pct(n.distanceBps)} away`}
            </Text>
          ) : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md },
  heading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
});
