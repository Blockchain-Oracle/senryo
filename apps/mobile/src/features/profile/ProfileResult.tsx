/**
 * The own profile's period result (F2, F-D4; Fomo F16's "$0.00" with 24h · 7d · 30d · All): the realized PnL for the
 * period as the one hero (AmountHero, signed and coloured), the chips below it, one line under it — "Rank 12 · 34
 * trades" or "Not ranked · 34 trades" — and the account-value chart for the same period below. The figure is the
 * leaderboard's own standing for this account, so the profile and the board always agree (defect 12). It needs the
 * api session: a locked phone gets "Unlock to see your result", never Face ID on open. No trades → "No trades · 7d",
 * never $0. Not listed here → "Not public on Mainnet".
 */
import type { Address } from "@senryo/account";
import type { LeaderboardPeriod } from "@senryo/api-client";
import { useEquityHistory, useLeaderboard } from "@senryo/query";
import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EquityChart } from "~/components/charts/EquityChart";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { PeriodChips } from "~/components/kit/PeriodChips";
import { Skeleton } from "~/components/kit/states";
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "~/features/social/leaderboard-copy";
import { useSessionGate } from "~/features/social/useSocialAccount";
import { signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The chart's window per period, in seconds (All = a year: the indexer keeps every snapshot). */
const WINDOW_SEC: Record<LeaderboardPeriod, number> = {
  "24h": 86_400,
  "7d": 604_800,
  "30d": 2_592_000,
  all: 31_536_000,
};
const MS_PER_SECOND = 1000;
const HERO_SKELETON_WIDTH = "48%";
const CHART_HEIGHT = SIZE.chartEquity;

export function ProfileResult({ address }: { address: Address }) {
  const { color } = useTheme();
  const network = useNetwork();
  const gate = useSessionGate();
  const [period, setPeriod] = useState<LeaderboardPeriod>(DEFAULT_PERIOD);
  const board = useLeaderboard(period, "all");
  const value = board.status === "fresh" || board.status === "stale" ? board.value : undefined;
  const you = value?.you ?? undefined;
  const pnl = you?.netPnlUsd6 ?? null;
  const trades = you?.trades ?? null;
  const tradeWord = trades === null ? null : `${trades} ${trades === 1 ? "trade" : "trades"}`;
  const label = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;

  let hero: ReactNode;
  let line: string | undefined;
  if (gate.status === "locked" || gate.status === "failed") {
    hero = <Button label="Unlock to see your result" variant="secondary" size="sm" block={false} onPress={gate.open} />;
  } else if (board.status === "failed") {
    hero = <Text style={[TYPE.rowTitle, { color: color.text3 }]}>Couldn’t load the result</Text>;
  } else if (!value || !you) {
    hero = <Skeleton width={HERO_SKELETON_WIDTH} height={TYPE.displayBalance.lineHeight ?? SIZE.skeletonRow} />;
  } else if (you.status === "not_listed") {
    hero = <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Not public on {network.modeLabel}</Text>;
  } else if (pnl === null || you.status === "no_activity") {
    hero = <Text style={[TYPE.sectionTitle, { color: color.ink }]}>No trades · {label}</Text>;
  } else {
    hero = <AmountHero text={signedUsd(pnl)} color={pnl < 0n ? color.down : pnl > 0n ? color.up : color.ink} />;
    const place = you.status === "ranked" && you.globalRank ? `Rank ${you.globalRank}` : "Not ranked";
    line = tradeWord ? `${place} · ${tradeWord}` : place;
  }

  return (
    <View style={styles.stack}>
      <View style={styles.top}>
        <View style={styles.hero}>{hero}</View>
        <View style={styles.periods}>
          <PeriodChips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Result period" />
        </View>
      </View>
      {line ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{line}</Text> : null}
      <Curve address={address} period={period} tone={pnl !== null && pnl < 0n ? "down" : "up"} />
    </View>
  );
}

/** The account value over the same period; a quiet empty plot until there are two points. */
function Curve({ address, period, tone }: { address: Address; period: LeaderboardPeriod; tone: "up" | "down" }) {
  const curve = useEquityHistory(address, WINDOW_SEC[period]);
  const points = curve.status === "fresh" || curve.status === "stale" ? curve.value : undefined;
  if (curve.status === "unknown") return <Skeleton height={CHART_HEIGHT} />;
  if (!points || points.length < 2) return <View style={styles.empty} />;
  return (
    <EquityChart points={points.map((p) => ({ t: p.timestamp * MS_PER_SECOND, equity6: p.equityInit }))} tone={tone} />
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.sm },
  top: { gap: SPACE.sm },
  hero: { flexShrink: 1 },
  periods: { alignSelf: "flex-end" },
  empty: { height: SPACE.xl },
});
