/**
 * Your record (R5.20; the web's `StatsCard`, Owarine's account stats on 21st Stats Band's plain grid — numbers on the
 * page, no boxes): lifetime PnL, win rate, trades, win streak, best streak and volume over everything traded on this
 * network, read through `statsView`. Money hides with Hide balances; counts don't.
 */
import { statsView } from "@senryo/calls";
import { signedUsd, toneOf, usd } from "@senryo/core";
import { useCallerStats } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SPACE, TYPE, useTheme } from "~/theme";

const COLUMNS = 3;
const FULL = 100;

export function StatsCard({ owner }: { owner: `0x${string}` }) {
  const { color } = useTheme();
  const stats = useCallerStats(owner);
  const [hidden] = useHideBalances();
  if (!("value" in stats) || stats.value.calls === 0) return null;
  const v = statsView(stats.value);
  const tone = toneOf(v.pnl);
  const cells = [
    {
      label: "Lifetime PnL",
      value: masked(signedUsd(v.pnl), hidden),
      ink: tone === "up" ? color.up : tone === "down" ? color.down : color.ink,
    },
    { label: "Win rate", value: v.winRate, ink: color.ink },
    { label: "Trades", value: String(v.trades), ink: color.ink },
    { label: "Win streak", value: String(v.streak), ink: color.ink },
    { label: "Best streak", value: String(v.bestStreak), ink: color.ink },
    { label: "Volume", value: masked(usd(v.volume), hidden), ink: color.ink },
  ];
  return (
    <View style={styles.grid} accessibilityLabel="Your record">
      {cells.map((c) => (
        <View key={c.label} style={styles.cell} accessible accessibilityLabel={`${c.label} ${c.value}`}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{c.label}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[TYPE.numMd, { color: c.ink }]}>
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACE.md, paddingBottom: SPACE.sm },
  cell: { width: `${FULL / COLUMNS}%`, gap: SPACE.xxs, paddingRight: SPACE.sm },
});
