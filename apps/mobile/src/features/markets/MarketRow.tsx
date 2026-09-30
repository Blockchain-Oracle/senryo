import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkline } from "~/components/charts/Sparkline";
import { fire } from "~/feedback/fire";
import { tradeRoute } from "~/lib/constants/routes";
import { arrow, price, signedPct } from "~/lib/money";
import type { SampleMarket } from "~/lib/sample";
import { DISABLED_OPACITY, HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const STATUS_LABEL = { open: "Open", closed: "Closed", soon: "Coming soon" } as const;
const VENUE_LABEL = { senryo: "Senryo", perpl: "Perpl" } as const;
const PRICE_DECIMALS_SMALL = 4;
const SMALL_PRICE_E8 = 1_000_000_000n;

/** One watchlist row (21st Market Watchlist #20110): name, venue · status · max leverage, sparkline, price, change. */
export function MarketRow({ market, first }: { market: SampleMarket; first: boolean }) {
  const { color } = useTheme();
  const up = market.change24hBps >= 0n;
  const tint = up ? color.up : color.down;
  const live = market.status !== "soon";
  const shown = market.priceE8 < SMALL_PRICE_E8 ? PRICE_DECIMALS_SMALL : undefined;
  return (
    <Pressable
      disabled={!live}
      onPress={() => {
        fire("tick");
        router.push(tradeRoute(market.id));
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !live }}
      accessibilityLabel={`${market.name}, ${VENUE_LABEL[market.venue]}, ${STATUS_LABEL[market.status]}, price ${price(market.priceE8, shown)}, ${up ? "up" : "down"} ${signedPct(market.change24hBps)}`}
      style={({ pressed }) => [
        styles.row,
        first ? null : { borderTopWidth: HAIRLINE_PX, borderTopColor: color.hairline },
        pressed ? { backgroundColor: color.muted } : null,
        live ? null : { opacity: DISABLED_OPACITY },
      ]}
    >
      <View style={styles.name}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{market.id}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {VENUE_LABEL[market.venue]} · {STATUS_LABEL[market.status]} · {market.maxLeverage}x max
        </Text>
      </View>
      <Sparkline values={market.spark} stroke={tint} />
      <View style={styles.price}>
        <Text style={[TYPE.numSm, { color: color.ink }]}>${price(market.priceE8, shown)}</Text>
        <Text style={[TYPE.numSm, { color: tint }]}>
          {arrow(market.change24hBps)} {signedPct(market.change24hBps)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.md,
    minHeight: SIZE.touch + SPACE.xl,
  },
  name: { flex: 1, gap: SPACE.xxs },
  price: { alignItems: "flex-end", gap: SPACE.xxs, minWidth: SIZE.sparklineWidth + SPACE.lg },
});
