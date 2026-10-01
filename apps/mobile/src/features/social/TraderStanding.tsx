/**
 * A trader's result on the board (Fomo F16's big figure with its 24h / 7d / 30d / All chips, adapted): the one
 * dominant number of the profile is their realized P&L for the chosen period, with their place under it. The figure
 * comes from the same board the Leaderboard shows; a trader who isn't on it gets a plain sentence and the floor, never
 * a zero.
 */
import type { Address } from "@senryo/account";
import type { LeaderboardPeriod } from "@senryo/api-client";
import { useLeaderboard } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { Skeleton } from "~/components/kit/states";
import { signedUsd } from "~/lib/money";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { sameAddress } from "./format";
import { DEFAULT_PERIOD, floorCopy, METRIC_COPY, PERIOD_BOARD, PERIOD_OPTIONS, PERIOD_WORDS } from "./leaderboard-copy";

const FIGURE_HEIGHT = TYPE.displayPrice.lineHeight ?? 0;
/** The loading figure is about as wide as a five-digit result. */
const FIGURE_SKELETON_WIDTH = "56%";

export function TraderStanding({ address }: { address: Address }) {
  const { color } = useTheme();
  const [period, setPeriod] = useState<LeaderboardPeriod>(DEFAULT_PERIOD);
  const reading = useLeaderboard(period, "all");
  const board = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  const entry = board?.entries.find((row) => sameAddress(row.address, address));
  return (
    <View style={styles.block}>
      <View style={styles.bleed}>
        <ChipRow options={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Result period" />
      </View>
      {reading.status === "unknown" ? <Skeleton width={FIGURE_SKELETON_WIDTH} height={FIGURE_HEIGHT} /> : null}
      {reading.status === "failed" ? (
        <Text style={[TYPE.body, { color: color.text3 }]}>
          The board couldn’t be loaded, so there is no result to show.
        </Text>
      ) : null}
      {board && entry ? (
        <View accessible style={styles.figure}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            style={[TYPE.displayPrice, { color: entry.netPnlUsd6 >= 0n ? color.up : color.down }]}
          >
            {signedUsd(entry.netPnlUsd6)}
          </Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            {METRIC_COPY[board.metric].line} · {PERIOD_WORDS[period]} · rank {entry.globalRank} · {entry.trades}{" "}
            {entry.trades === 1 ? "trade" : "trades"}
          </Text>
        </View>
      ) : null}
      {board && !entry ? (
        <View style={styles.figure}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Not on the {PERIOD_BOARD[period]} board</Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            The board lists its top traders. Ranking starts at {floorCopy(board.floor)} in the period.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.md },
  /** The chip row carries its own gutter (it is built to run edge to edge under a header). */
  bleed: { marginHorizontal: -SIZE.gutter },
  figure: { gap: SPACE.xs },
});
