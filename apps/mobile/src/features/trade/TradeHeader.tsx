import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { ageLabel, STATUS_LABEL, statusTone } from "~/features/markets/session";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { arrow, price18, priceDecimalsOf, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000n;

/**
 * Market detail's identity + price block (Fomo F32/F35 anatomy, FT095; J3 completes the page in S1b.9): the market's
 * own art (~48 pt, v2-plan §5.12), symbol with its max-leverage chip and name, the explicit venue chip; then the
 * oracle price (Inter Display 40/44) with the 24 h change, and the session + oracle freshness line ("Oracle price ·
 * updated 3m ago", D-020) as plain text behind its status dot — no plate, no outline.
 */
export function TradeHeader({ line }: { line: MarketLine }) {
  const network = useNetwork();
  const { color } = useTheme();
  const change = line.change24hBps;
  const age = ageLabel(line.updatedAt, BigInt(Date.now()) / MS_PER_SECOND);
  const shown = price18(line.price18, priceDecimalsOf(line.marketId));
  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <EntityMark id={ids.engineMarket(network.chainId, line.marketId)} size={SIZE.markDetail} decorative />
        <View style={styles.titles}>
          <View style={styles.symbolRow}>
            <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{line.symbol}</Text>
            <Text
              style={[TYPE.chipLabel, styles.lev, { color: color.link, backgroundColor: color.mainnetSurface }]}
              accessibilityLabel={`Up to ${line.maxLeverageX} times leverage`}
            >
              {line.maxLeverageX}×
            </Text>
          </View>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{line.name} / USD</Text>
        </View>
        <VenueChip venue={ids.venue("senryo")} />
      </View>
      <View>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          style={[TYPE.displayPrice, { color: color.ink }]}
          accessibilityLabel={`Oracle price ${shown} dollars, updated ${age}`}
        >
          ${shown}
        </Text>
        {change === undefined ? (
          <Text style={[TYPE.moneyMeta, { color: color.text3 }]}>24h —</Text>
        ) : (
          <Text style={[TYPE.moneyMeta, { color: change >= 0n ? color.up : color.down }]}>
            {arrow(change)} {signedPct(change)} <Text style={{ color: color.text3 }}>24h</Text>
          </Text>
        )}
      </View>
      <View style={styles.fresh}>
        <View style={[styles.dot, { backgroundColor: statusTone(line.status, color) }]} />
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {STATUS_LABEL[line.status]} · Oracle price · updated {age}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flex: 1, gap: SPACE.xxs },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  lev: { paddingHorizontal: SPACE.xs, borderRadius: RADIUS.xs, overflow: "hidden" },
  fresh: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
