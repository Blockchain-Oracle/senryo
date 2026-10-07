import { notional } from "@senryo/core";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ArrowLeftRight } from "~/components/kit/symbols";
import { LeverageBadge } from "~/features/markets/LeverageBadge";
import { PriceFreshness } from "~/features/markets/PriceFreshness";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { arrow, price18, priceDecimalsOf, signedPct, usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The header mark: 40 pt, so four utility circles still fit beside the ticker on a 375 pt phone. */
const HEADER_MARK = SIZE.avatarMd;

/**
 * Market detail's identity, in the page's bar (Fomo F32; flow book C2 step 1): the market's own art, the ticker with
 * the max-leverage badge, and its short name with the venue under it. Mark, ticker and name are configuration, so
 * they show before the oracle answers; the badge waits for the engine's margin parameter. `venue` names a venue that
 * isn't Senryo with its badge on the mark.
 */
export function MarketIdentity({
  mark,
  symbol,
  name,
  maxLeverageX,
  venue = "Senryo",
  venueMark,
}: {
  mark: string;
  symbol: string;
  name: string;
  maxLeverageX: number | undefined;
  venue?: string;
  venueMark?: string | undefined;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.identity}>
      <EntityMark id={mark} badge={venueMark} size={HEADER_MARK} label={symbol} decorative />
      <View style={styles.titles}>
        <View style={styles.symbolRow}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            accessibilityRole="header"
            accessibilityLabel={`${name}, ${symbol}, ${venue}`}
            numberOfLines={1}
            style={[TYPE.sectionTitle, styles.shrink, { color: color.ink }]}
          >
            {symbol}
          </Text>
          {maxLeverageX === undefined ? null : <LeverageBadge x={maxLeverageX} />}
        </View>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowDetail, { color: color.text3 }]}
        >
          {name} · {venue}
        </Text>
      </View>
    </View>
  );
}

/** The 24 h change with ▲▼ and a sign (never colour alone); "—" while the day-old candle is unknown. */
export function Change({ bps, suffix }: { bps: bigint | undefined; suffix: boolean }) {
  const { color } = useTheme();
  if (bps === undefined)
    return (
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: color.text3 }]}>
        24h —
      </Text>
    );
  return (
    <Text
      maxFontSizeMultiplier={CONTROL_FONT_SCALE}
      style={[TYPE.rowChange, { color: bps >= 0n ? color.up : color.down }]}
    >
      {arrow(bps)} {signedPct(bps)}
      {suffix ? (
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: color.text3 }}>
          {" "}
          24h
        </Text>
      ) : null}
    </Text>
  );
}

/**
 * The price block under the bar (Fomo F32): the oracle price as the page's one figure with its 24 h change under it,
 * and at the right open interest — both sides at the oracle price, in this network's money. The oracle's age and
 * session state live in About → Technical details and the state banner, not on a dot line here.
 */
export function PriceBlock({ line }: { line: MarketLine }) {
  const { color } = useTheme();
  const shown = price18(line.price18, priceDecimalsOf(line.marketId));
  const openInterest = usd(notional(line.market.book.longSize + line.market.book.shortSize, line.price18), 0);
  return (
    <View style={styles.block}>
      <View style={styles.flex}>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[TYPE.displayPrice, { color: color.ink }]}
          accessibilityLabel={`Price ${shown} dollars`}
        >
          ${shown}
        </Text>
        <Change bps={line.change24hBps} suffix />
        <PriceFreshness market={line.market} />
      </View>
      <View style={styles.oi} accessible accessibilityLabel={`Open interest ${openInterest}`}>
        <View style={styles.inline}>
          <ArrowLeftRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
            {openInterest}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
          Open interest
        </Text>
      </View>
    </View>
  );
}

/** The bar's price once the big one has scrolled under it (F33): price over change, right-aligned. */
export function CompactPrice({ line }: { line: MarketLine }) {
  const { color } = useTheme();
  return (
    <View style={styles.compact}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]} numberOfLines={1}>
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
  shrink: { flexShrink: 1 },
  block: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
  flex: { flex: 1, gap: SPACE.xxs },
  oi: { alignItems: "flex-end", gap: SPACE.xxs, paddingTop: SPACE.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  compact: { alignItems: "flex-end", gap: SPACE.xxs },
});
