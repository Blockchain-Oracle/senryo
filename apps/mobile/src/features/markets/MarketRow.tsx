import { ENGINE_MARKETS, marketPair } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Sparkline } from "~/components/charts/Sparkline";
import { EntityMark } from "~/components/identity/EntityMark";
import { Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { marketRoute } from "~/lib/constants/routes";
import { arrow, price18, priceDecimalsOf, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
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
/** Above this Dynamic Type scale the row drops its sparkline. */
const SPARKLINE_MAX_FONT_SCALE = 1.2;

export function EngineMarketRow({ marketId, onOpen }: { marketId: number; onOpen?: () => void }) {
  const network = useNetwork();
  const { color } = useTheme();
  const meta = ENGINE_MARKETS.find((m) => m.id === marketId);
  const reading = useMarketLine(marketId, meta?.symbol ?? "");
  const now = useNowSec();
  // With large text the name needs the sparkline's width; the price and change carry the movement alone.
  const roomy = useWindowDimensions().fontScale < SPARKLINE_MAX_FONT_SCALE;
  const mark = ids.engineMarket(network.chainId, marketId);
  const client = useQueryClient();
  const retrying = useIsFetching({ queryKey: ["market", network.chainId] }) > 0;
  if (reading.status === "unknown" || reading.status === "failed") {
    const failed = reading.status === "failed";
    // Loading and failed are different states (review S05): both still open the market (its page has its own
    // states), and a failed read says so, with a Retry that shows when it is working.
    return (
      <Pressable
        onPress={() => {
          fire("tick");
          onOpen?.();
          router.push(marketRoute(meta?.symbol ?? String(marketId)));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${meta?.name ?? meta?.symbol}, ${failed ? "price unavailable" : "reading the price"}`}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <EntityMark id={mark} size={SIZE.markDetail} decorative />
        <View style={styles.name}>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
            {meta?.category === "fx" ? meta.symbol : (meta?.name ?? meta?.symbol)}
          </Text>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowDetail, { color: failed ? color.warn : color.text3 }]}
          >
            {failed ? "Price unavailable" : "Reading the oracle"}
          </Text>
        </View>
        {failed ? (
          <Pressable
            onPress={() => {
              fire("tick");
              void client.invalidateQueries({ queryKey: ["market", network.chainId] });
            }}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel={`Retry reading ${meta?.name ?? "the price"}`}
            accessibilityState={{ busy: retrying }}
            hitSlop={SPACE.sm}
            style={[styles.retry, { backgroundColor: color.raised2 }]}
          >
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.ink }]}>
              {retrying ? "Retrying…" : "Retry"}
            </Text>
          </Pressable>
        ) : (
          <Skeleton width={SIZE.sparklineWidth} height={SIZE.skeletonLine} />
        )}
      </Pressable>
    );
  }
  const line = reading.value;
  const change = line.change24hBps;
  const tint = change === undefined ? color.inkMuted : change >= 0n ? color.up : color.down;
  const age = ageLabel(line.updatedAt, now);
  const changeText = change === undefined ? "24h —" : `${arrow(change)} ${signedPct(change)}`;
  // A currency reads as its code over its pair ("GBP" over "GBP/USD"); "British pound" would truncate beside the
  // sparkline, and the full name is on the market page.
  const fx = meta?.category === "fx";
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
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]}
            numberOfLines={1}
          >
            {fx ? line.symbol : line.name}
          </Text>
          <LeverageBadge x={line.maxLeverageX} />
        </View>
        <View style={styles.detailLine}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowDetail, styles.shrink, { color: color.text3 }]}
            numberOfLines={1}
          >
            {fx && meta ? marketPair(meta) : line.symbol}
          </Text>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            ·{" "}
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: statusTone(line.status, color) }}>
              {STATUS_LABEL[line.status]}
            </Text>
          </Text>
        </View>
      </View>
      {roomy ? <Sparkline values={line.spark} stroke={tint} /> : null}
      <View style={styles.price}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
          ${price18(line.price18, priceDecimalsOf(marketId))}
        </Text>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: tint }]}>
          {changeText}
        </Text>
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
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.rowTitle, { color: color.ink }]}
          numberOfLines={1}
        >
          {market.symbol}
        </Text>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.rowDetail, { color: color.text3 }]}
          numberOfLines={1}
        >
          {market.name} · {market.venue}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
        {market.note}
      </Text>
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
  retry: {
    paddingHorizontal: SPACE.md,
    minHeight: SIZE.touch - SPACE.md,
    borderRadius: BUTTON.radius.sm,
    justifyContent: "center",
  },
  // The name gives way before the session word: "British pound · Open", never "British pound · O…".
  detailLine: { flexDirection: "row", gap: SPACE.xs },
  shrink: { flexShrink: 1 },
  price: { alignItems: "flex-end", gap: SPACE.xxs, minWidth: SIZE.sparklineWidth + SPACE.lg },
});
