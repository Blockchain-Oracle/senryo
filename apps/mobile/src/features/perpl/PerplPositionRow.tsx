/**
 * A Perpl position on Home → Positions (plan §0.9 Home; flow book C4 "After"): the `PositionRow` anatomy — the
 * market's mark with Perpl's badge, ticker + side badge, "size · leverage · entry" quietly under it, and at the right
 * the Exchange's own P&L at its mark over the distance to liquidation (shown only under 25 %). Also the free balance
 * row: AUSD sitting on Perpl outside any position, with the way back to the wallet.
 */
import type { PerplPosition } from "@senryo/chain";
import { perplLiquidationPrice, perplNotional } from "@senryo/chain";
import { usePerplMarketTerms } from "@senryo/query";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { usePressScale } from "~/components/kit/usePressScale";
import { SideBadge } from "~/features/portfolio/SideBadge";
import { fire } from "~/feedback/fire";
import { perplPositionRoute, perplWithdrawRoute } from "~/lib/constants/routes";
import { arrow, pct } from "~/lib/money";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { liqDistanceBps, perplPrice, perplSignedUsd, perplSize, perplUsd } from "./format";
import { PERPL_VENUE_MARK, perplMarketById } from "./market";

/** A page-wide row barely moves under the finger. */
const ROW_PRESS_SCALE = 0.985;
/** "liq x% away" shows only when closer than this (§0.9 Home). */
const LIQ_SHOWN_UNDER_BPS = 2_500n;

function Row({
  index,
  onPress,
  label,
  children,
}: {
  index: number;
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
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
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export function PerplPositionRow({ position, index = 0 }: { position: PerplPosition; index?: number }) {
  const { color } = useTheme();
  const meta = perplMarketById(position.marketId);
  const terms = usePerplMarketTerms(position.marketId);
  const t = terms.status === "fresh" || terms.status === "stale" ? terms.value : undefined;
  if (!meta) return null;
  const notional = perplNotional(position.lots, position.entryPricePNS, meta);
  const leverage = position.depositCNS > 0n ? notional / position.depositCNS : undefined;
  const liq = t
    ? perplLiquidationPrice({
        side: position.side,
        entryPricePNS: position.entryPricePNS,
        lots: position.lots,
        depositCNS: position.depositCNS,
        premiumPnlCNS: position.premiumPnlCNS,
        maintMarginFracHdths: t.maintMarginFracHdths,
        priceDecimals: meta.priceDecimals,
        lotDecimals: meta.lotDecimals,
      })
    : null;
  const away = t ? liqDistanceBps(t.markPNS, liq, position.side) : null;
  const near = away !== null && away < LIQ_SHOWN_UNDER_BPS;
  const pnl = position.pnlCNS;
  const detail = `${perplSize(position.lots, meta)}${leverage === undefined ? "" : ` · ${leverage}×`} · entry ${perplPrice(position.entryPricePNS, meta)}`;
  return (
    <Row
      index={index}
      onPress={() => router.push(perplPositionRoute(position.marketId))}
      label={`${meta.name} ${position.side} on Perpl, ${detail}, ${pnl < 0n ? "loss" : "profit"} ${perplSignedUsd(pnl)}`}
    >
      <EntityMark id={meta.mark} badge={meta.venueMark} size={SIZE.markDetail} label={meta.symbol} decorative />
      <View style={styles.name}>
        <View style={styles.title}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowTitle, { color: color.ink }]}
            numberOfLines={1}
          >
            {meta.symbol}
          </Text>
          <SideBadge isLong={position.side === "long"} />
        </View>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.rowDetail, { color: color.text3 }]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
      <View style={styles.result}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.rowPrice, { color: pnl < 0n ? color.down : color.up }]}
          numberOfLines={1}
        >
          {arrow(pnl)} {perplSignedUsd(pnl)}
        </Text>
        {near ? (
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowChange, { color: away !== null && away <= 0n ? color.down : color.warn }]}
            numberOfLines={1}
          >
            {away !== null && away <= 0n ? "liq now" : `liq ${pct(away ?? 0n)} away`}
          </Text>
        ) : null}
      </View>
    </Row>
  );
}

/** AUSD on Perpl outside any position — after a close or an order that matched nobody — and the way back. */
export function PerplBalanceRow({ freeCNS, index = 0 }: { freeCNS: bigint; index?: number }) {
  const { color } = useTheme();
  return (
    <Row
      index={index}
      onPress={() => router.push(perplWithdrawRoute)}
      label={`Free on Perpl ${perplUsd(freeCNS)}. Move it back to your wallet`}
    >
      <EntityMark id={PERPL_VENUE_MARK} size={SIZE.markDetail} label="Perpl" decorative />
      <View style={styles.name}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
          Perpl balance
        </Text>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
          Free · not in a position
        </Text>
      </View>
      <View style={styles.result}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
          {perplUsd(freeCNS)}
        </Text>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: color.link }]}>
          Move back ›
        </Text>
      </View>
    </Row>
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
  result: { alignItems: "flex-end", gap: SPACE.xxs },
});
