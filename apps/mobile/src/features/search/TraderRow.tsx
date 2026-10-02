import type { AddressStanding } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "~/components/kit/states";
import { TraderAvatar, type TraderIdentity, traderDetail, traderName } from "~/features/social/TraderAvatar";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { signedUsd } from "~/lib/money";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The width of a result while it loads. */
const RESULT_SKELETON = 64;

/**
 * A trader in a list (search results, recents; Fomo F06/F30 row anatomy, F1): avatar, name, the @handle or short
 * address under it, and their 7d realized result at the trailing edge when it is known (`standing`: "loading" draws
 * a skeleton, null or a standing without numbers draws nothing — never a fake $0) — the same bare row as a market, so mixed results line up. Opens the
 * trader's page (`/watch/…`); `onOpen` runs first (Search remembers what was opened).
 */
export function TraderRow({
  trader,
  standing,
  onOpen,
}: {
  trader: TraderIdentity;
  standing?: AddressStanding | null | "loading" | undefined;
  onOpen?: () => void;
}) {
  const { color } = useTheme();
  const name = traderName(trader);
  const detail = traderDetail(trader);
  const pnl = standing && standing !== "loading" ? standing.netPnlUsd6 : null;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onOpen?.();
        router.push(watchRoute(trader.address) as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Trader ${name}, ${detail}${pnl === null ? "" : `, ${signedUsd(pnl)} in 7 days`}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <TraderAvatar trader={trader} size={SIZE.avatarMd} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          {detail}
        </Text>
      </View>
      {standing === "loading" ? <Skeleton width={RESULT_SKELETON} /> : null}
      {pnl === null ? null : (
        <View style={styles.result}>
          <Text style={[TYPE.rowPrice, { color: pnl >= 0n ? color.up : color.down }]}>{signedUsd(pnl)}</Text>
          <Text style={[TYPE.rowChange, { color: color.text3 }]}>7d</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
  result: { alignItems: "flex-end", gap: SPACE.xxs },
});
