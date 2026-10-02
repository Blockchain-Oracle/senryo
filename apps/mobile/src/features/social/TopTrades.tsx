/**
 * The Global feed's pinned card (Fomo F15's pinned recap, adapted; direction §9 "Top Trades"): this week's verified
 * top trades — the best closed position per trader since Monday 00:00 UTC, net of fees, funding and borrow — when the
 * api has any. With none there is nothing to pin, so the card isn't drawn; nothing is invented to fill it.
 */
import type { TopTrade } from "@senryo/api-client";
import { useTopTrades } from "@senryo/query";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Panel } from "~/components/kit/Surface";
import { Pin } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { marketOfId, nameOf, SIDE_WORD } from "./format";
import { TraderAvatar } from "./TraderAvatar";

/** The card is a summary: the first three, as a podium. */
const SHOWN = 3;

export function TopTrades() {
  const { color } = useTheme();
  const reading = useTopTrades();
  if (reading.status === "unknown" || reading.status === "failed") return null;
  const items = reading.value.items.slice(0, SHOWN);
  if (items.length === 0) return null;
  return (
    <Panel style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[TYPE.rowTitle, styles.title, { color: color.ink }]}>
          Top trades this week
        </Text>
        <Pin size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Pinned</Text>
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        Best closed position per trader since Monday 00:00 UTC, after fees and funding. Read from the chain.
      </Text>
      <View>
        {items.map((trade) => (
          <TopTradeRow key={trade.positionId} trade={trade} />
        ))}
      </View>
    </Panel>
  );
}

function TopTradeRow({ trade }: { trade: TopTrade }) {
  const network = useNetwork();
  const { color } = useTheme();
  const market = marketOfId(network.chainId, trade.marketId, trade.symbol);
  const name = nameOf(trade.trader);
  const long = trade.side === "LONG";
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(watchRoute(trade.trader.address) as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${trade.rank}, ${name}, ${trade.symbol} ${SIDE_WORD[trade.side].toLowerCase()}, ${signedUsd(trade.netPnlUsd6)}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.rowPressed } : null]}
    >
      <Text style={[TYPE.rowChange, styles.rank, { color: color.text3 }]}>{trade.rank}</Text>
      <TraderAvatar avatar={trade.trader.avatar} address={trade.trader.address} size={SIZE.avatarSm} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[TYPE.row, { color: color.ink }]}>
          {name}
        </Text>
        <View style={styles.market}>
          <EntityMark id={market?.mark} size={SIZE.markChip} label={trade.symbol} decorative ground={color.card} />
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            {trade.symbol} · <Text style={{ color: long ? color.up : color.down }}>{SIDE_WORD[trade.side]}</Text>
          </Text>
        </View>
      </View>
      <Text style={[TYPE.rowPrice, { color: trade.netPnlUsd6 >= 0n ? color.up : color.down }]}>
        {signedUsd(trade.netPnlUsd6)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  title: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight - SPACE.sm,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.sm,
  },
  rank: { minWidth: SPACE.lg, textAlign: "center" },
  text: { flex: 1, gap: SPACE.xxs },
  market: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
