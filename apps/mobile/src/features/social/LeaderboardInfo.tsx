/**
 * "How ranking works" (direction §9: publish the definition): what is ranked, over which window, the floor an account
 * must clear, which money the board is in and when it was last rebuilt — all read from the board the api returned for
 * the period on screen, so the explanation and the numbers can't disagree.
 */
import type { LeaderboardPeriod } from "@senryo/api-client";
import { useLeaderboard } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { clockTime } from "~/lib/format";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";
import { floorCopy, METRIC_COPY, PERIOD_WORDS, windowCopy } from "./leaderboard-copy";

const LOADING_LINES = ["80%", "100%", "64%"] as const;

export function LeaderboardInfo({ period }: { period: LeaderboardPeriod }) {
  const { color } = useTheme();
  const network = useNetwork();
  const reading = useLeaderboard(period, "all");
  if (reading.status === "unknown") {
    return (
      <Panel style={styles.panel}>
        {LOADING_LINES.map((width) => (
          <Skeleton key={width} width={width} />
        ))}
      </Panel>
    );
  }
  if (reading.status === "failed") {
    return (
      <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>
        The definition comes with the board, and the board couldn’t be loaded. Close this and try again.
      </Text>
    );
  }
  const board = reading.value;
  const metric = METRIC_COPY[board.metric];
  const facts = [
    { title: metric.line, body: metric.detail },
    { title: `Period: ${PERIOD_WORDS[period]}`, body: windowCopy(board.window) },
    {
      title: "The floor",
      body: `An account is ranked from ${floorCopy(board.floor)} in the period. Under that it is Not ranked, never placed last.`,
    },
    {
      title: `${network.modeLabel} board`,
      body: "Practice and Mainnet are ranked separately, each in its own money. Only profiles listed on a network appear on its board.",
    },
  ];
  return (
    <>
      <Panel style={styles.panel}>
        {facts.map((fact) => (
          <View key={fact.title} style={styles.fact}>
            <Text style={[TYPE.rowStrong, { color: color.ink }]}>{fact.title}</Text>
            <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{fact.body}</Text>
          </View>
        ))}
      </Panel>
      <Text style={[TYPE.meta, styles.center, { color: color.text3 }]}>
        Rebuilt every minute · last at {clockTime(Date.parse(board.computedAt))}. Following a trader never copies a
        trade.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.lg },
  fact: { gap: SPACE.xs },
  center: { textAlign: "center" },
});
