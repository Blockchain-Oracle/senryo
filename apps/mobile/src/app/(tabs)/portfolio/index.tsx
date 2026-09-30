import type { AccountSnapshot } from "@senryo/chain";
import { RISK } from "@senryo/core";
import { useAccountRisk, useEquityHistory, usePositions } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EquityChart } from "~/components/charts/EquityChart";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { BucketRegister, type Buckets } from "~/features/portfolio/BucketRegister";
import { DAY_SEC, MS_PER_SECOND, WINDOW_SEC } from "~/features/portfolio/constants";
import { PositionsTable } from "~/features/portfolio/PositionsTable";
import { useAccount } from "~/lib/account/provider";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { arrow, signedPct, signedUsd, usd } from "~/lib/money";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";

const TIMEFRAMES = [
  { value: "1H", label: "1H" },
  { value: "24H", label: "24H" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "ALL", label: "All" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["value"];

/** Buckets from the finalized snapshot: Locked = what backs margin, holds and the buffer (equity − Free to trade). */
function bucketsOf(s: AccountSnapshot): Buckets {
  const locked = s.equityInit - s.freeToTrade;
  return {
    freeToTrade6: s.freeToTrade,
    freeToSpend6: s.freeToSpend,
    locked6: locked > 0n ? locked : 0n,
    inPerpl6: undefined,
  };
}

/** Portfolio (D2 home): equity hero + chart, the bucket register, positions. Empty account → the Add-money card. */
export default function Portfolio() {
  const { color } = useTheme();
  const account = useAccount();
  const address = account.hint?.address;
  const [frame, setFrame] = useState<Timeframe>("24H");
  const risk = useAccountRisk(address, "finalized");
  const live = useAccountRisk(address, "latest");
  const day = useEquityHistory(address, DAY_SEC);
  const curve = useEquityHistory(address, WINDOW_SEC[frame]);
  const positions = usePositions(address);

  if (!address) {
    return (
      <Screen>
        <AccountStrip />
        <EmptyState
          why="No account on this phone yet"
          detail={`Create one with Face ID to trade gold and silver — ${ACTIVE_NETWORK.modeLabel.toLowerCase()} funds are on the house.`}
          action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AccountStrip />
      <ReadingView reading={risk} loading="line" loadingLabel="Reading your balance">
        {(s) => {
          const first = day.status === "fresh" || day.status === "stale" ? day.value[0] : undefined;
          const change = first ? s.equityInit - first.equityInit : undefined;
          const changeBps =
            first && first.equityInit > 0n && change !== undefined ? (change * RISK.BPS) / first.equityInit : undefined;
          return (
            <View style={styles.hero}>
              <SectionLabel>EQUITY · RISK-ADJUSTED · {ACTIVE_NETWORK.modeLabel.toUpperCase()}</SectionLabel>
              <Text
                maxFontSizeMultiplier={HERO_FONT_SCALE}
                accessibilityLabel={`Equity ${usd(s.equityInit)}`}
                style={[TYPE.numHero, { color: color.ink }]}
              >
                {usd(s.equityInit)}
              </Text>
              {change === undefined ? (
                <Text style={[TYPE.numSm, { color: color.inkMuted }]}>24h —</Text>
              ) : (
                <Text style={[TYPE.numSm, { color: change >= 0n ? color.up : color.down }]}>
                  {arrow(change)} {signedUsd(change)}
                  {changeBps === undefined ? "" : ` (${signedPct(changeBps)})`} 24h
                </Text>
              )}
            </View>
          );
        }}
      </ReadingView>
      <ReadingView reading={curve} loading="chart" loadingLabel="Loading equity history">
        {(points) =>
          points.length < 2 ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              The chart starts with your first deposit or trade.
            </Text>
          ) : (
            <EquityChart points={points.map((p) => ({ t: p.timestamp * MS_PER_SECOND, equity6: p.equityInit }))} />
          )
        }
      </ReadingView>
      <Segmented options={TIMEFRAMES} value={frame} onChange={setFrame} label="Chart timeframe" />
      <ReadingView reading={risk} loading="plate" loadingLabel="Reading buckets">
        {(s) =>
          s.equityInit === 0n && s.positionBitmap === 0 ? (
            <EmptyState
              why="Nothing here yet"
              detail="Claim practice funds or deposit from any chain — then gold is one hold away."
              action={{ label: "Add money", onPress: () => router.push(ROUTES.addMoney) }}
            />
          ) : (
            <BucketRegister buckets={bucketsOf(s)} />
          )
        }
      </ReadingView>
      <ReadingView reading={positions} loading="list" loadingLabel="Syncing positions">
        {(list) => (
          <View style={styles.section}>
            <SectionLabel>POSITIONS · {list.length}</SectionLabel>
            {list.length === 0 ? (
              <EmptyState
                why="No open positions"
                detail="Gold and silver trade nearly 24/5 at the oracle price. Start small in practice mode."
                action={{ label: "Browse markets", onPress: () => router.navigate(ROUTES.markets) }}
              />
            ) : live.status === "fresh" || live.status === "stale" ? (
              <PositionsTable positions={list} account={live.value} />
            ) : null}
          </View>
        )}
      </ReadingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACE.sm },
  section: { gap: SPACE.md },
});
