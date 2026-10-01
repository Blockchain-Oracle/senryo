/**
 * A market that doesn't trade here yet, still discoverable (review S03): its real mark, ticker, what it is and that it
 * is read-only (or which blocker stops it), with the live price and 24 h change from its authoritative source — Perpl's
 * mark price, or a calculated wrapper feed's price — and the row opens its read-only page. Nothing is invented: a price
 * that can't be read says so.
 */
import type { DiscoveryInstrument } from "@senryo/config";
import type { Reading } from "@senryo/core";
import type { DiscoveryQuote } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Skeleton } from "~/components/kit/states";
import { tokenPrice } from "~/features/tokens/format";
import { fire } from "~/feedback/fire";
import { discoverRoute } from "~/lib/constants/routes";
import { arrow, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { discoveryMark } from "./discovery-marks";
import { gateShort } from "./discovery-words";

const PRICE_SKELETON = 72;

export function DiscoveryRow({
  instrument,
  reading,
}: {
  instrument: DiscoveryInstrument;
  reading: Reading<DiscoveryQuote>;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const gate = instrument.execution[network.chainId];
  const quote = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  const change = quote?.change24h.available ? quote.change24h.value.bps : undefined;
  const tint = change === undefined ? color.text3 : change >= 0n ? color.up : color.down;
  // A calculated feed's row names the wrapper it prices (wSPYx), never the share as if it traded.
  const what = instrument.class === "crypto" ? instrument.name : `${instrument.wrapper.symbol} feed`;
  const state = gateShort(gate);
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(discoverRoute(instrument.id));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${instrument.symbol}, ${instrument.class === "crypto" ? what : instrument.displayName}, ${state}${quote ? `, ${tokenPrice(quote.price18)}` : ""}`}
      accessibilityHint="Opens its read-only page"
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <EntityMark id={discoveryMark(instrument)} size={SIZE.markDetail} decorative />
      <View style={styles.name}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowTitle, { color: color.ink }]}
        >
          {instrument.symbol}
        </Text>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowDetail, { color: color.text3 }]}
        >
          {what} · {state}
        </Text>
      </View>
      <View style={styles.price}>
        {reading.status === "unknown" ? (
          <Skeleton width={PRICE_SKELETON} />
        ) : (
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
            {quote ? tokenPrice(quote.price18) : "Price unavailable"}
          </Text>
        )}
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: tint }]}>
          {change === undefined ? "24h —" : `${arrow(change)} ${signedPct(change)}`}
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
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  name: { flex: 1, gap: SPACE.xxs },
  price: { alignItems: "flex-end", gap: SPACE.xxs },
});
