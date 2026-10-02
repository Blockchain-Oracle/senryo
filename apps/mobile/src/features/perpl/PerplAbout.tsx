/**
 * A Perpl market's About tab (Fomo F35; flow book C2 step 3): what it is in two sentences, a stats grid — Max
 * leverage · Taker fee · Funding now · Open interest · Volume, 24 h · Maintenance — and "Technical details" (the
 * Exchange, the market id, its price and lot precision, the order type). Every value is Perpl's own read; one that
 * can't be read is left out, never estimated.
 */

import type { PerplMarketTerms } from "@senryo/chain";
import { explorerAddressUrl, PERPL_EXCHANGE, PERPL_SLIPPAGE_BPS } from "@senryo/config";
import { BPS_DENOMINATOR, DECIMALS, formatUnits, shortAddress } from "@senryo/core";
import type { DiscoveryQuote } from "@senryo/query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { DetailRow, Disclosure } from "~/features/markets/Disclosure";
import { compactUsd6 } from "~/features/tokens/format";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { fundingText, leverageX } from "./format";
import { PERPL_CHAIN, type PerplMarketMeta } from "./market";
import { feePct } from "./words";

const HDTHS_PER_X = 100n;
const PCT_SHOWN = 1;
const PRESSED = 0.6;
/** Two cells per row, so values line up in columns. */
const CELL_SHARE = "47%";

const bpsPct = (bps: bigint, shown: number = DECIMALS.cents) => `${formatUnits(bps, DECIMALS.bpsAsPct, shown)}%`;

export function PerplAbout({
  meta,
  terms,
  quote,
}: {
  meta: PerplMarketMeta;
  terms: PerplMarketTerms | undefined;
  quote: DiscoveryQuote | undefined;
}) {
  const { color } = useTheme();
  const stats: { label: string; value: string }[] = [];
  if (terms) stats.push({ label: "Max leverage", value: `${leverageX(terms.maxLeverageHdths)}×` });
  if (terms) stats.push({ label: "Taker fee", value: feePct(terms.takerFeePpm) });
  if (quote?.funding.available) stats.push({ label: "Funding now", value: fundingText(quote.funding.value) });
  if (quote?.openInterest.available)
    stats.push({ label: "Open interest", value: `${compactUsd6(quote.openInterest.value.usd6)} a side` });
  if (quote?.volume24hUsd6.available)
    stats.push({ label: "Volume, 24 h", value: compactUsd6(quote.volume24hUsd6.value) });
  if (terms)
    stats.push({
      label: "Maintenance",
      value: bpsPct((BPS_DENOMINATOR * HDTHS_PER_X) / terms.maintMarginFracHdths, PCT_SHOWN),
    });
  const exchange = PERPL_EXCHANGE[PERPL_CHAIN];
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        About {meta.name}
      </Text>
      <Text style={[TYPE.body, { color: color.text2 }]}>
        {meta.name} perpetual on Perpl, priced at Perpl’s mark. Long profits when {meta.symbol} rises, short when it
        falls; it settles in AUSD and no {meta.symbol} changes hands.
      </Text>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.cell} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[TYPE.rowPrice, { color: color.ink }]}
            >
              {s.value}
            </Text>
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
      <Disclosure title="Technical details">
        <Pressable
          onPress={() => {
            fire("tick");
            void Linking.openURL(explorerAddressUrl(PERPL_CHAIN, exchange));
          }}
          accessibilityRole="link"
          accessibilityLabel={`Perpl Exchange: ${shortAddress(exchange)}`}
          accessibilityHint="Opens the explorer"
          style={({ pressed }) => [styles.link, { opacity: pressed ? PRESSED : 1 }]}
        >
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Perpl Exchange</Text>
          <Text style={[TYPE.rowAmount, { color: color.link }]}>{shortAddress(exchange)}</Text>
        </Pressable>
        <DetailRow label="Market id" value={String(meta.marketId)} />
        <DetailRow label="Price precision" value={`${meta.priceDecimals} decimals`} />
        <DetailRow label="Size unit" value={`${formatUnits(1n, meta.lotDecimals, meta.lotDecimals)} ${meta.symbol}`} />
        <DetailRow label="Order type" value={`Market (IOC at mark ± ${bpsPct(PERPL_SLIPPAGE_BPS)})`} />
        <DetailRow label="Collateral" value="AUSD · isolated per position" />
        <DetailRow label="Venue" value="Perpl · Mainnet" />
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACE.lg, columnGap: SPACE.lg },
  cell: { width: CELL_SHARE, gap: SPACE.xxs },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.lg,
    minHeight: SIZE.touch - SPACE.sm,
  },
});
