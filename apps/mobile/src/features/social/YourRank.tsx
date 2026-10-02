/**
 * The "Your rank" plate (Fomo F29, F1): a filled strip above the board with your avatar, your place and your realized
 * result for the period. Every standing is one short line — ranked, "Not ranked · 3 trades to rank", "No trades",
 * "Not ranked · Make public" — and a rank that doesn't exist is "Not ranked", never 0; a result that doesn't exist
 * isn't printed. Before the api knows who is asking, the plate says how to find out instead of guessing.
 */
import type { Leaderboard, Standing } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useGroupFill } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { signedUsd, usd } from "~/lib/money";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { TraderAvatar } from "./TraderAvatar";
import { useSessionGate } from "./useSocialAccount";

/** Skeleton width for a standing that is still being read. */
const PENDING_WIDTH = "50%";
/** A floor is a round threshold: no cents. */
const FLOOR_DECIMALS = 0;

/** What is still missing to be ranked: trades first, then volume ("3 trades to rank", "$400 to rank"). */
export function toRank(you: Standing, floor: Leaderboard["floor"]): string {
  const trades = floor.minTrades - (you.trades ?? 0);
  if (trades > 0) return `${trades} ${trades === 1 ? "trade" : "trades"} to rank`;
  const volume = floor.minNotionalUsd6 - (you.notionalUsd6 ?? 0n);
  return volume > 0n ? `${usd(volume, FLOOR_DECIMALS)} to rank` : "Ranked at the next update";
}

interface Plate {
  /** The standing itself: a place, "Not ranked", or what to do to see it. */
  value: ReactNode;
  detail?: string;
  pnl?: bigint | null;
  onPress?: () => void;
}

export function YourRank({ board }: { board: Leaderboard }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const gate = useSessionGate();
  const press = usePressScale();
  const word = (text: string) => <Text style={[TYPE.rowTitle, { color: color.ink }]}>{text}</Text>;

  const standing = (you: Standing): Plate => {
    switch (you.status) {
      case "ranked":
        return {
          value: (
            <Text style={[TYPE.numMd, { color: color.ink }]}>
              <Text style={{ color: color.link }}># </Text>
              {you.rank ?? "–"}
            </Text>
          ),
          pnl: you.netPnlUsd6,
        };
      case "below_floor":
        return { value: word("Not ranked"), detail: toRank(you, board.floor), pnl: you.netPnlUsd6 };
      case "no_activity":
        return { value: word("Not ranked"), detail: "No trades" };
      case "not_listed":
        return {
          value: word("Not ranked"),
          detail: "Make public",
          onPress: () => router.push(ROUTES.accountProfile as Href),
        };
    }
  };

  let plate: Plate;
  if (gate.status === "guest") {
    plate = { value: word("Not ranked"), detail: "Create account", onPress: () => router.push(ROUTES.accountRequired) };
  } else if (gate.status === "locked") {
    plate = { value: word("Unlock to see"), onPress: gate.open };
  } else if (gate.status === "failed") {
    plate = { value: word("Couldn’t confirm it’s you"), detail: "Try again", onPress: gate.open };
  } else if (gate.status === "pending" || !board.you) {
    plate = { value: <Skeleton width={PENDING_WIDTH} /> };
  } else {
    plate = standing(board.you);
  }

  const { pnl } = plate;
  const body = (
    <>
      <TraderAvatar {...(gate.address ? { address: gate.address } : {})} />
      <View style={styles.text}>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>Your rank</Text>
        {plate.value}
        {plate.detail ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{plate.detail}</Text> : null}
      </View>
      {pnl === undefined || pnl === null ? null : (
        <Text style={[TYPE.rowPrice, { color: pnl >= 0n ? color.up : color.down }]}>{signedUsd(pnl)}</Text>
      )}
    </>
  );
  if (!plate.onPress) return <View style={[styles.plate, { backgroundColor: fill }]}>{body}</View>;
  const { onPress } = plate;
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.plate, { backgroundColor: pressed ? color.rowPressed : fill }]}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SHEET_SHAPE.rowMinHeight,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: SHEET_SHAPE.rowRadius,
  },
  text: { flex: 1, gap: SPACE.xxs, minHeight: SIZE.avatarMd, justifyContent: "center" },
});
