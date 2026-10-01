import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { ageLabel, STATUS_CHIP, statusTone } from "~/features/markets/session";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { arrow, price18, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000n;

/**
 * Market header: the market's own art (~48 pt, v2-plan §5.12), symbol and the explicit venue chip; oracle price and
 * 24 h change; session chip, max leverage and the honest oracle line on the right ("Oracle price · updated 3m ago",
 * D-020). PRACTICE/MAINNET on every money surface.
 */
export function TradeHeader({ line }: { line: MarketLine }) {
  const network = useNetwork();
  const { color } = useTheme();
  const change = line.change24hBps;
  const age = ageLabel(line.updatedAt, BigInt(Date.now()) / MS_PER_SECOND);
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.identity}>
          <EntityMark id={ids.engineMarket(network.chainId, line.marketId)} size={SIZE.markDetail} decorative />
          <View style={styles.titles}>
            <Text style={[TYPE.numMd, { color: color.ink }]}>
              {line.symbol}-PERP <Text style={[TYPE.label, { color: color.inkMuted }]}>{line.name} / USD</Text>
            </Text>
            <VenueChip venue={ids.venue("senryo")} />
          </View>
        </View>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          style={[TYPE.numLg, { color: color.ink }]}
          accessibilityLabel={`Oracle price ${price18(line.price18)} dollars, updated ${age}`}
        >
          {price18(line.price18)}
        </Text>
        {change === undefined ? (
          <Text style={[TYPE.numSm, { color: color.inkMuted }]}>24h —</Text>
        ) : (
          <Text style={[TYPE.numSm, { color: change >= 0n ? color.up : color.down }]}>
            {arrow(change)} {signedPct(change)} · 24h
          </Text>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>
          SESSION <Text style={{ color: statusTone(line.status, color) }}>{STATUS_CHIP[line.status]}</Text>
        </Text>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>
          {line.maxLeverageX}× MAX · {network.modeLabel.toUpperCase()}
        </Text>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>ORACLE · {age}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  left: { gap: SPACE.xs, flexShrink: 1 },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  titles: { gap: SPACE.xs, flexShrink: 1 },
  right: { alignItems: "flex-end", gap: SPACE.xs },
});
