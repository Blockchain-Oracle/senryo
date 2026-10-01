import type { AccountSnapshot, PositionView } from "@senryo/chain";
import { ENGINE_MARKETS } from "@senryo/config";
import { notional, previewPosition } from "@senryo/core";
import { ids } from "@senryo/identity";
import { riskViewOf, useMarket } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Skeleton } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { positionRoute } from "~/lib/constants/routes";
import { arrow, pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { effectiveLeverage } from "./leverage";
import { SideBadge } from "./SideBadge";

/** A page-wide row barely moves under the finger (the same reason as a sheet row). */
const ROW_PRESS_SCALE = 0.985;
/** The right column while a row's market is still being read. */
const PENDING_WIDTH = 88;

/** "liq 12% away" · "liq now" · "no liquidation" — how far the oracle is from this position's liquidation price. */
export function liquidationLabel(awayBps: bigint | null): string {
  if (awayBps === null) return "no liquidation";
  return awayBps <= 0n ? "liq now" : `liq ${pct(awayBps)} away`;
}

/**
 * One open position in the `MarketRow` anatomy (Fomo F09/F12, C22): bare on the page — no card, no divider — with the
 * market's own 48 pt mark, the symbol with its side badge ("Long 2.4×", the word before the colour), exposure and
 * entry as the quiet second line, and at the right the unrealised P&L at the conservative exit (signed, with ▲▼) over
 * the distance to liquidation. It prices itself from its market's live oracle view through the core preview, with the
 * account's other positions held fixed. Rows arrive in a short stagger and open the position's page.
 */
export function PositionRow({
  position,
  account,
  index = 0,
}: {
  position: PositionView;
  /** The latest account snapshot; the right column waits for it. */
  account: AccountSnapshot | undefined;
  /** Position in the list, for the entrance stagger. */
  index?: number;
}) {
  const network = useNetwork();
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const market = useMarket(position.marketId);
  const symbol = ENGINE_MARKETS.find((m) => m.id === position.marketId)?.symbol ?? `#${position.marketId}`;
  const side = position.isLong ? "long" : "short";
  const m = market.status === "fresh" || market.status === "stale" ? market.value : undefined;
  const health = m && account ? previewPosition(m.risk, m.pv, riskViewOf(account), position) : undefined;
  const exposure = m ? notional(position.size, m.pv.price18) : undefined;
  const leverage = exposure !== undefined && account ? effectiveLeverage(exposure, account.equityInit) : undefined;
  const entry = price18(position.entry, priceDecimalsOf(position.marketId));
  const away = health?.liqDistanceBps ?? null;
  const summary = health
    ? `${health.upnlUsd6 < 0n ? "loss" : "profit"} ${signedUsd(health.upnlUsd6)}, ${
        away === null ? "no liquidation price" : away <= 0n ? "at liquidation" : `liquidation ${pct(away)} away`
      }`
    : market.status === "failed"
      ? "price unavailable"
      : "reading the price";
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
    >
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            router.push(positionRoute(String(position.marketId)));
          }}
          accessibilityRole="button"
          accessibilityLabel={`${m?.name ?? symbol} ${side}${
            exposure === undefined ? "" : `, exposure ${usd(exposure, 0)}`
          }${leverage ? `, ${leverage.replace("×", " times")} your balance` : ""}, entry ${entry}, ${summary}`}
          accessibilityHint="Opens the position"
          style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
        >
          <EntityMark id={ids.engineMarket(network.chainId, position.marketId)} size={SIZE.markDetail} decorative />
          <View style={styles.name}>
            <View style={styles.title}>
              <Text style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]} numberOfLines={1}>
                {symbol}
              </Text>
              <SideBadge isLong={position.isLong} leverage={leverage} />
            </View>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
              {exposure === undefined ? `Entry ${entry}` : `${usd(exposure, 0)} · entry ${entry}`}
            </Text>
          </View>
          {health ? (
            <View style={styles.result}>
              <Text style={[TYPE.rowPrice, { color: health.upnlUsd6 < 0n ? color.down : color.up }]} numberOfLines={1}>
                {arrow(health.upnlUsd6)} {signedUsd(health.upnlUsd6)}
              </Text>
              <Text
                style={[TYPE.rowChange, { color: away !== null && away <= 0n ? color.down : color.text3 }]}
                numberOfLines={1}
              >
                {liquidationLabel(away)}
              </Text>
            </View>
          ) : market.status === "failed" ? (
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Price unavailable</Text>
          ) : (
            <View style={styles.result}>
              <Skeleton width={PENDING_WIDTH} />
              <Skeleton width={PENDING_WIDTH - SPACE.xl} height={SIZE.skeletonSmall} />
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
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
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  result: { alignItems: "flex-end", gap: SPACE.xxs },
});
