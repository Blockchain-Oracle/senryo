/**
 * People → Leaderboard (Fomo F29, F1): scope chips All · Following at the leading edge and the period chips 24h · 7d
 * · 30d · All at the trailing edge (7d first, the api's default), what is ranked with its ⓘ sheet, the "Your rank"
 * plate, then the ranked rows — medal or place, avatar, name over @handle, signed realized P&L in the mode's money and
 * the markets traded. Following ranks you among the people you follow (it needs a session). Practice and Mainnet are
 * separate boards. A rank is never 0: under the floor it is "Not ranked".
 */
import type { Leaderboard as Board, LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from "@senryo/api-client";
import { socialKeys, useLeaderboard, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { PeriodChips } from "~/components/kit/PeriodChips";
import { ErrorState, StaleStamp } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { leaderboardInfoRoute, ROUTES } from "~/lib/constants/routes";
import { clockTime } from "~/lib/format";
import { signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { isNotComputed, marketOfSymbol, sameAddress } from "./format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "./leaderboard-copy";
import { PersonRow } from "./PersonRow";
import { PeopleSkeleton, QuietLine } from "./Quiet";
import { useQueryError } from "./useQueryError";
import { useSessionGate, useSocialAccount } from "./useSocialAccount";
import { YourRank } from "./YourRank";

const SCOPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "following", label: "Following" },
] as const satisfies readonly { value: LeaderboardScope; label: string }[];

/** The rank column: wide enough for a medal, and for three digits beside it. */
const RANK_WIDTH = 28;
/** Rows past this one arrive together (30 ms stagger, once per mount). */
const STAGGER_ROWS = 8;

export function Leaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>(DEFAULT_PERIOD);
  const [scope, setScope] = useState<LeaderboardScope>("all");
  const { color } = useTheme();
  return (
    <View style={styles.page}>
      <View style={styles.controls}>
        <PeriodChips options={SCOPE_OPTIONS} value={scope} onChange={setScope} label="Who is ranked" />
        <PeriodChips options={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Ranking period" />
      </View>
      <Pressable
        onPress={() => {
          fire("tick");
          router.push(leaderboardInfoRoute(period) as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel="Ranked by realized P&L after fees. How ranking works"
        hitSlop={SPACE.sm}
        style={styles.definition}
      >
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Realized P&L after fees</Text>
        <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
      {scope === "following" ? <FollowingBoard period={period} /> : <BoardReading period={period} scope="all" />}
    </View>
  );
}

/** Following ranks among the people you follow: it waits for a session, never prompting by being on screen. */
function FollowingBoard({ period }: { period: LeaderboardPeriod }) {
  const gate = useSessionGate();
  if (gate.status === "guest") {
    return (
      <QuietLine
        text="Follow traders"
        action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
      />
    );
  }
  if (gate.status === "locked")
    return <QuietLine text="Unlock to rank" action={{ label: "Unlock", onPress: gate.open }} />;
  if (gate.status === "failed") {
    return <QuietLine text="Couldn’t confirm it’s you" action={{ label: "Try again", onPress: gate.open }} />;
  }
  if (gate.status === "pending") return <PeopleSkeleton />;
  return <BoardReading period={period} scope="following" />;
}

function BoardReading({ period, scope }: { period: LeaderboardPeriod; scope: LeaderboardScope }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = useLeaderboard(period, scope);
  const key = socialKeys.leaderboard(env.chainId, period, scope);
  const error = useQueryError(key);
  const retry = () => void client.invalidateQueries({ queryKey: key });
  if (reading.status === "unknown") return <PeopleSkeleton />;
  if (reading.status === "failed") {
    return isNotComputed(error) ? (
      <QuietLine text="Board updating" action={{ label: "Retry", onPress: retry }} />
    ) : (
      <ErrorState diagnosis={reading.error} retry={retry} />
    );
  }
  return (
    <>
      {reading.status === "stale" ? (
        <StaleStamp at={reading.at} refreshing={reading.refreshing} failed={reading.error !== undefined} />
      ) : null}
      <Ranked board={reading.value} />
    </>
  );
}

function Ranked({ board }: { board: Board }) {
  const { color } = useTheme();
  const { address: me } = useSocialAccount();
  return (
    <>
      <YourRank board={board} />
      {board.entries.length === 0 ? (
        <QuietLine text="No ranked traders yet" />
      ) : (
        <View>
          {board.entries.map((entry, i) => (
            <Animated.View
              key={entry.address}
              entering={FadeInDown.duration(TIMING.staggerItem)
                .delay(Math.min(i, STAGGER_ROWS) * TIMING.stagger)
                .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
            >
              <LeaderRow entry={entry} you={sameAddress(entry.address, me)} />
            </Animated.View>
          ))}
        </View>
      )}
      <Text style={[TYPE.meta, styles.updated, { color: color.text3 }]}>
        Updated {clockTime(Date.parse(board.computedAt))}
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
 * third metal) with the place inside it (medal size after 21st.dev arihantcodes_1f7b8c4d/leaderboard-table, id 30672);
 * from fourth on the place is a quiet number (F29).
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: SPACE.sm,
  },
  definition: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, alignSelf: "flex-start" },
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
