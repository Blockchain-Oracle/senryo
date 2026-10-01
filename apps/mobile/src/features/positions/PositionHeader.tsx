import type { PositionView } from "@senryo/chain";
import { ids } from "@senryo/identity";
import type { LiveMarket } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { STATUS_LABEL, statusTone } from "~/features/markets/session";
import { SideBadge } from "~/features/portfolio/SideBadge";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The position's identity (Fomo F13/F14's instrument row; C25): the market's own 48 pt mark, the symbol with the side
 * badge ("Long 2.4×") beside it, the explicit venue chip under it, and the market's session status at the right as a
 * dot and a word in its tone — no plate around any of it.
 */
export function PositionHeader({ market, position }: { market: LiveMarket; position: PositionView }) {
  const network = useNetwork();
  const { color } = useTheme();
  const tone = statusTone(market.pv.status, color);
  return (
    <View style={styles.head}>
      <EntityMark id={ids.engineMarket(network.chainId, market.marketId)} size={SIZE.markDetail} decorative />
      <View style={styles.titles}>
        <View style={styles.symbol}>
          <Text
            accessibilityRole="header"
            accessibilityLabel={`${market.name} ${position.isLong ? "long" : "short"}`}
            style={[TYPE.sectionTitle, styles.shrink, { color: color.ink }]}
            numberOfLines={1}
          >
            {market.symbol}
          </Text>
          <SideBadge isLong={position.isLong} />
        </View>
        <VenueChip venue={ids.venue("senryo")} />
      </View>
      <View style={styles.status} accessible accessibilityLabel={`Market ${STATUS_LABEL[market.pv.status]}`}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text style={[TYPE.chipCategory, { color: tone }]}>{STATUS_LABEL[market.pv.status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flex: 1, gap: SPACE.xs },
  symbol: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
