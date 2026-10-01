/**
 * People → Leaderboard (Fomo F29, C30; direction §9): period chips, one line saying what is ranked (with the full
 * definition a tap away), the "Your rank" plate, then the ranked rows — medal for the first three, avatar, name,
 * signed realized P&L in the mode's money and the markets traded. Practice and Mainnet are separate boards. An
 * account under the floor or without activity is "Not ranked": a rank is never shown as 0.
 */
import type { Leaderboard as Board, LeaderboardEntry, LeaderboardPeriod } from "@senryo/api-client";
import { socialKeys, useLeaderboard, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { Info } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { ChipRow } from "~/components/kit/ChipRow";
import { ErrorState, StaleStamp } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { leaderboardInfoRoute } from "~/lib/constants/routes";
import { clockTime } from "~/lib/format";
import { signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { isNotComputed, marketOfSymbol, sameAddress } from "./format";
import { DEFAULT_PERIOD, METRIC_COPY, PERIOD_OPTIONS, PERIOD_WORDS } from "./leaderboard-copy";
import { PersonRow } from "./PersonRow";
import { PeopleSkeleton, QuietLine } from "./Quiet";
import { useQueryError } from "./useQueryError";
import { useSocialAccount } from "./useSocialAccount";
import { YourRank } from "./YourRank";

/** The rank column: wide enough for a medal, and for three digits beside it. */
const RANK_WIDTH = 28;

export function Leaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>(DEFAULT_PERIOD);
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const client = useQueryClient();
  const reading = useLeaderboard(period, "all");
  const key = socialKeys.leaderboard(env.chainId, period, "all");
  const error = useQueryError(key);
  const retry = () => void client.invalidateQueries({ queryKey: key });
  const board = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <View style={styles.page}>
      <View style={styles.bleed}>
        <ChipRow options={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Ranking period" />
      </View>
      <Pressable
        onPress={() => {
          fire("tick");
          router.push(leaderboardInfoRoute(period) as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Ranked by ${METRIC_COPY.realized_pnl_after_fees_funding_borrow.line}, ${PERIOD_WORDS[period]}. How ranking works`}
        hitSlop={SPACE.sm}
        style={styles.definition}
      >
        <Text style={[TYPE.rowDetail, styles.definitionText, { color: color.text3 }]}>
          {board ? METRIC_COPY[board.metric].line : METRIC_COPY.realized_pnl_after_fees_funding_borrow.line} ·{" "}
          {PERIOD_WORDS[period]}
        </Text>
        <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
      {reading.status === "stale" ? (
        <StaleStamp at={reading.at} refreshing={reading.refreshing} failed={reading.error !== undefined} />
      ) : null}
      {reading.status === "unknown" ? <PeopleSkeleton /> : null}
      {reading.status === "failed" ? (
        isNotComputed(error) ? (
          <QuietLine
            text={`The ${network.modeLabel} board isn’t computed yet. It is rebuilt every minute.`}
            action={{ label: "Try again", onPress: retry }}
          />
        ) : (
          <ErrorState diagnosis={reading.error} retry={retry} />
        )
      ) : null}
      {board ? <Ranked board={board} /> : null}
    </View>
  );
}

function Ranked({ board }: { board: Board }) {
  const { color } = useTheme();
  const { address: me } = useSocialAccount();
  return (
    <>
      <YourRank board={board} />
      {board.entries.length === 0 ? (
        <QuietLine text="Nobody is ranked for this period yet" />
      ) : (
        <View>
          {board.entries.map((entry) => (
            <LeaderRow key={entry.address} entry={entry} you={sameAddress(entry.address, me)} />
          ))}
        </View>
      )}
      <Text style={[TYPE.meta, styles.updated, { color: color.text3 }]}>
        Updated {clockTime(Date.parse(board.computedAt))} · rebuilt every minute
      </Text>
    </>
  );
}

function LeaderRow({ entry, you }: { entry: LeaderboardEntry; you: boolean }) {
  const { color } = useTheme();
  const network = useNetwork();
  const gain = entry.netPnlUsd6 >= 0n;
  const marks = entry.markets
    .map((symbol) => marketOfSymbol(network.chainId, symbol).mark)
    .filter((mark): mark is string => mark !== undefined);
  return (
    <PersonRow
      person={entry}
      leading={<Rank rank={entry.rank} />}
      note={you ? "You" : undefined}
      trailing={
        <View
          style={styles.result}
          accessible
          accessibilityLabel={`Rank ${entry.rank}, ${gain ? "up" : "down"} ${signedUsd(entry.netPnlUsd6)}${entry.markets.length > 0 ? `, traded ${entry.markets.join(", ")}` : ""}`}
        >
          <Text style={[TYPE.rowPrice, { color: gain ? color.up : color.down }]}>{signedUsd(entry.netPnlUsd6)}</Text>
          {marks.length > 0 ? <MarkCluster ids={marks} size={SIZE.markChip} ground={color.ground} /> : null}
        </View>
      }
    />
  );
}

const PODIUM = 3;

/**
 * The first three wear a medal — a filled disc in gold, silver, then the neutral raised plate (the palette has no
 * third metal) — with the place inside it; from fourth on the place is a quiet number (F29).
 */
function Rank({ rank }: { rank: number }) {
  const { color } = useTheme();
  if (rank > PODIUM) {
    return <Text style={[TYPE.rowChange, styles.rank, { color: color.text3 }]}>{rank}</Text>;
  }
  const fill = rank === 1 ? color.gold : rank === 2 ? color.silver : color.raised2;
  const ink = rank === PODIUM ? color.ink : color.paperInk;
  return (
    <View style={[styles.medal, { backgroundColor: fill }]}>
      <Text style={[TYPE.moneyMeta, { color: ink }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  /** The chip row carries its own gutter (it is built to run edge to edge under a header). */
  bleed: { marginHorizontal: -SIZE.gutter },
  definition: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  definitionText: { flexShrink: 1 },
  result: { alignItems: "flex-end", gap: SPACE.xs },
  rank: { width: RANK_WIDTH, textAlign: "center" },
  medal: {
    width: RANK_WIDTH,
    height: RANK_WIDTH,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  updated: { textAlign: "center" },
});
