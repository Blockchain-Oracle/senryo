import { ENGINE_MARKETS } from "@senryo/config";
import { ids } from "@senryo/identity";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkline } from "~/components/charts/Sparkline";
import { EntityMark } from "~/components/identity/EntityMark";
import { Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { marketRoute } from "~/lib/constants/routes";
import { arrow, price18, priceDecimalsOf, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { LeverageBadge } from "./LeverageBadge";
import { ageLabel, STATUS_LABEL, statusTone } from "./session";
import type { ArrivingMarket } from "./universe";
import { useMarketLine } from "./useMarketLine";
import { useNowSec } from "./useNowSec";

/**
 * One market row (Fomo F09/F12, C22): bare on the page — no card, no divider — with a 48 pt mark (the market's own
 * art: koban / chōgin), name with its max-leverage badge over ticker · session, a sparkline from hourly Chainlink
 * rounds, and the oracle price over its 24 h change with ▲▼ and a sign (never colour alone). The mark is the market's
 * identity, so it shows while the price is still loading. The press plate reaches a little past the text so it reads
 * as a rounded row. `onOpen` runs before the push (Search remembers what was opened).
 */
export function EngineMarketRow({ marketId, onOpen }: { marketId: number; onOpen?: () => void }) {
  const network = useNetwork();
  const { color } = useTheme();
  const meta = ENGINE_MARKETS.find((m) => m.id === marketId);
  const reading = useMarketLine(marketId, meta?.symbol ?? "");
  const now = useNowSec();
  const mark = ids.engineMarket(network.chainId, marketId);
  if (reading.status === "unknown" || reading.status === "failed") {
    return (
      <View style={styles.row}>
        <EntityMark id={mark} size={SIZE.markDetail} decorative />
        <View style={styles.name}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{meta?.symbol}</Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            {reading.status === "failed" ? "Price unavailable · retrying" : "Reading the oracle"}
          </Text>
        </View>
        <Skeleton width={SIZE.sparklineWidth} height={SIZE.skeletonLine} />
      </View>
    );
  }
  const line = reading.value;
  const change = line.change24hBps;
  const tint = change === undefined ? color.inkMuted : change >= 0n ? color.up : color.down;
  const age = ageLabel(line.updatedAt, now);
  const changeText = change === undefined ? "24h —" : `${arrow(change)} ${signedPct(change)}`;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onOpen?.();
        router.push(marketRoute(line.symbol));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${line.name}, Senryo, ${line.maxLeverageX > 0 ? `up to ${line.maxLeverageX} times leverage, ` : ""}${STATUS_LABEL[line.status]}, price ${price18(line.price18, priceDecimalsOf(marketId))} dollars, updated ${age}${change === undefined ? "" : `, ${change >= 0n ? "up" : "down"} ${signedPct(change)}`}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <EntityMark id={mark} size={SIZE.markDetail} decorative />
      <View style={styles.name}>
        <View style={styles.titleLine}>
          <Text style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]} numberOfLines={1}>
            {line.name}
          </Text>
          <LeverageBadge x={line.maxLeverageX} />
        </View>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
          {line.symbol} · <Text style={{ color: statusTone(line.status, color) }}>{STATUS_LABEL[line.status]}</Text>
        </Text>
      </View>
      <Sparkline values={line.spark} stroke={tint} />
      <View style={styles.price}>
        <Text style={[TYPE.rowPrice, { color: color.ink }]}>${price18(line.price18, priceDecimalsOf(marketId))}</Text>
        <Text style={[TYPE.rowChange, { color: tint }]}>{changeText}</Text>
      </View>
    </Pressable>
  );
}

/**
 * A market that isn't tradeable here yet: its real mark and name, and the one short reason at the right — never a
 * price (plan §2.5: no fabricated numbers). Dimmed, and not a button: there is nothing to open.
 */
export function ArrivingMarketRow({ market }: { market: ArrivingMarket }) {
  const { color } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${market.name}, ${market.venue}, not tradeable yet: ${market.note}`}
      style={[styles.row, { opacity: DISABLED_OPACITY }]}
    >
      <EntityMark id={market.mark} size={SIZE.markDetail} label={market.symbol} decorative />
      <View style={styles.name}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
          {market.symbol}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
          {market.name} · {market.venue}
        </Text>
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{market.note}</Text>
    </View>
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
  name: { flex: 1, gap: SPACE.xxs },
  titleLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  price: { alignItems: "flex-end", gap: SPACE.xxs, minWidth: SIZE.sparklineWidth + SPACE.lg },
});
