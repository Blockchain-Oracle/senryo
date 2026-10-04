/**
 * A profile's period hero (Fomo F16, F2 step 4, F-D4): the big signed realized P&L for the chosen period with the
 * 24h · 7d · 30d · All chips below it (7d first), then one line — "Rank 12 · 34 trades", "Not ranked · 34 trades",
 * or "No trades · 7d", never a fake $0. The numbers come from the same snapshot as the leaderboard (the per-address
 * standings route), so a profile below the floor or outside the top rows still shows its result, and a profile and
 * its board row always agree.
 */
import type { Address } from "@senryo/account";
import type { LeaderboardPeriod } from "@senryo/api-client";
import { useStandings } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AmountHero } from "~/components/kit/AmountHero";
import { PeriodChips } from "~/components/kit/PeriodChips";
import { Skeleton } from "~/components/kit/states";
import { signedUsd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "./leaderboard-copy";

const FIGURE_HEIGHT = TYPE.displayBalance.lineHeight ?? 0;
/** The loading figure is about as wide as a five-digit result. */
const FIGURE_SKELETON_WIDTH = "48%";
const LINE_SKELETON_WIDTH = "36%";

const PERIOD_SHORT: Record<LeaderboardPeriod, string> = { "24h": "24h", "7d": "7d", "30d": "30d", all: "all time" };

export function TraderStanding({ address }: { address: Address }) {
  const { color } = useTheme();
  const [period, setPeriod] = useState<LeaderboardPeriod>(DEFAULT_PERIOD);
  const reading = useStandings([address], period);
  const standing = reading.status === "fresh" || reading.status === "stale" ? reading.value.items[0] : undefined;
  const pnl = standing?.netPnlUsd6 ?? null;
  const trades = standing?.trades ?? null;
  const tradesWord = trades === null ? "" : ` · ${trades} ${trades === 1 ? "trade" : "trades"}`;
  return (
    <View style={styles.block}>
      <View style={styles.top}>
        <View style={styles.figure}>
          {reading.status === "unknown" ? <Skeleton width={FIGURE_SKELETON_WIDTH} height={FIGURE_HEIGHT} /> : null}
          {standing && pnl !== null ? (
            <AmountHero
              text={signedUsd(pnl)}
              color={pnl >= 0n ? color.up : color.down}
              accessibilityLabel={`${signedUsd(pnl)} realized, ${PERIOD_SHORT[period]}`}
            />
          ) : null}
          {(standing && pnl === null) || reading.status === "failed" ? (
            <Text style={[TYPE.sheetTitle, { color: color.text3 }]}>—</Text>
          ) : null}
        </View>
        <View style={styles.periods}>
          <PeriodChips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Result period" />
        </View>
      </View>
      {reading.status === "unknown" ? <Skeleton width={LINE_SKELETON_WIDTH} /> : null}
      {reading.status === "failed" ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Result unavailable</Text>
      ) : null}
      {standing ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {standing.status === "ranked" && standing.rank !== null
            ? `Rank ${standing.rank}${tradesWord}`
            : standing.status === "below_floor"
              ? `Not ranked${tradesWord}`
              : `No trades · ${PERIOD_SHORT[period]}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.xs },
  top: { gap: SPACE.sm },
  figure: { flexShrink: 1 },
  periods: { alignSelf: "flex-end" },
});
