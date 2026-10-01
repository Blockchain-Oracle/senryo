import { notional } from "@senryo/core";
import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { LeverageBadge } from "~/features/markets/LeverageBadge";
import { ageLabel, STATUS_LABEL, statusTone } from "~/features/markets/session";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { useNowSec } from "~/features/markets/useNowSec";
import { arrow, price18, priceDecimalsOf, signedPct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Market detail's identity, in the page's bar (Fomo F32, FT095): the market's own art (48 pt, v2-plan §5.12), its
 * symbol with the max-leverage badge, and its name under it. Mark, symbol and name are the market's configuration, so
 * they show before the oracle answers; the badge waits for the engine's margin parameter.
 */
export function MarketIdentity({
  marketId,
  symbol,
  name,
  maxLeverageX,
}: {
  marketId: number;
  symbol: string;
  name: string;
  maxLeverageX: number | undefined;
}) {
  const network = useNetwork();
  const { color } = useTheme();
  return (
    <View style={styles.identity}>
      <EntityMark id={ids.engineMarket(network.chainId, marketId)} size={SIZE.markDetail} decorative />
      <View style={styles.titles}>
        <View style={styles.symbolRow}>
          <Text accessibilityRole="header" numberOfLines={1} style={[TYPE.sectionTitle, { color: color.ink }]}>
            {symbol}
          </Text>
          {maxLeverageX === undefined ? null : <LeverageBadge x={maxLeverageX} />}
        </View>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          {name} / USD
        </Text>
      </View>
    </View>
  );
}

/** The 24 h change with ▲▼ and a sign (never colour alone); "24h —" while the day-old candle is unknown. */
function Change({ bps, suffix }: { bps: bigint | undefined; suffix: boolean }) {
  const { color } = useTheme();
  if (bps === undefined) return <Text style={[TYPE.rowChange, { color: color.text3 }]}>24h —</Text>;
  return (
    <Text style={[TYPE.rowChange, { color: bps >= 0n ? color.up : color.down }]}>
      {arrow(bps)} {signedPct(bps)}
      {suffix ? <Text style={{ color: color.text3 }}> 24h</Text> : null}
    </Text>
  );
}

/**
 * The price block under the bar (F32/F35; direction §8 "price / change / freshness"): the oracle price as the page's
 * one dominant figure (Inter Display 40/44) with the 24 h change under it; at the right, open interest — both sides'
 * size at the oracle price, read from the engine's book, in this network's money; then one quiet freshness line
 * (session state · oracle · updated N ago, D-020) behind its status dot, with the explicit venue chip closing the row.
 * No plate, no outline.
 */
export function PriceBlock({ line }: { line: MarketLine }) {
  const { color } = useTheme();
  const now = useNowSec();
  const age = ageLabel(line.updatedAt, now);
  const shown = price18(line.price18, priceDecimalsOf(line.marketId));
  const openInterest = usd(notional(line.market.book.longSize + line.market.book.shortSize, line.price18), 0);
  return (
    <View style={styles.block}>
      <View>
        <View style={styles.pair}>
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[TYPE.displayPrice, styles.shrink, { color: color.ink }]}
            accessibilityLabel={`Oracle price ${shown} dollars, updated ${age}`}
          >
            ${shown}
          </Text>
          <Text style={[TYPE.rowPrice, { color: color.ink }]} accessibilityLabel={`Open interest ${openInterest}`}>
            {openInterest}
          </Text>
        </View>
        <View style={styles.pair}>
          <Change bps={line.change24hBps} suffix />
          <Text style={[TYPE.rowDetail, { color: color.text3 }]} accessibilityElementsHidden>
            Open interest
          </Text>
        </View>
      </View>
      <View style={styles.fresh}>
        <View style={[styles.dot, { backgroundColor: statusTone(line.status, color) }]} />
        {/* Short words so "updated N ago" is never the part the venue chip pushes out; VoiceOver hears it whole. */}
        <Text
          numberOfLines={1}
          accessibilityLabel={`${STATUS_LABEL[line.status]}, oracle price updated ${age}`}
          style={[TYPE.rowDetail, styles.flex, { color: color.text3 }]}
        >
          {STATUS_LABEL[line.status]} · Oracle · updated {age}
        </Text>
        <VenueChip venue={ids.venue("senryo")} />
      </View>
    </View>
  );
}

/** The bar's price once the big one has scrolled under it (F33): price over change, right-aligned. */
export function CompactPrice({ line }: { line: MarketLine }) {
  const { color } = useTheme();
  return (
    <View style={styles.compact}>
      <Text style={[TYPE.rowPrice, { color: color.ink }]} numberOfLines={1}>
        ${price18(line.price18, priceDecimalsOf(line.marketId))}
      </Text>
      <Change bps={line.change24hBps} suffix={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flex: 1, gap: SPACE.xxs },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  block: { gap: SPACE.md },
  pair: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.md },
  shrink: { flexShrink: 1 },
  flex: { flex: 1 },
  fresh: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
  compact: { alignItems: "flex-end", gap: SPACE.xxs },
});
