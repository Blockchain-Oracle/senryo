import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { Segmented } from "~/components/kit/Segmented";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { ageLabel, STATUS_LABEL, statusTone } from "~/features/markets/session";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { price18, priceDecimalsOf } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { Side } from "./useTicket";

const MS_PER_SECOND = 1000n;
const SIDES = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;

/**
 * The ticket's fixed identity zone (C39, Fomo F37): the market's own art, the symbol over the explicit venue chip,
 * the live oracle price and the order type on the right ("Market" — Senryo's engine fills at the oracle price;
 * there is no order-type choice to make, so it is a label, not Fomo's selector) with the session and the price's
 * freshness ("Open · 2m ago", "not live" when the socket is quiet — D-020). Under it the compact Long / Short
 * selector (a declared adaptation, Codex S1b.7 consult #11; fixed while a trade is in flight) beside the mode capsule
 * (direction §5.6: mode in the ticket header). Drags with the sheet's handle.
 */
export function TicketHeader({
  line,
  side,
  onSide,
  sideLocked,
}: {
  line: MarketLine;
  side: Side;
  onSide: (side: Side) => void;
  sideLocked: boolean;
}) {
  const network = useNetwork();
  const { color } = useTheme();
  const tone = (s: Side) => (s === "long" ? color.up : color.down);
  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <EntityMark id={ids.engineMarket(network.chainId, line.marketId)} size={SIZE.markDetail} decorative />
        <View style={styles.titles}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.sectionTitle, { color: color.ink }]}
            accessibilityLabel={`${line.name}, ${line.symbol}`}
          >
            {line.symbol}
          </Text>
          <VenueChip venue={ids.venue("senryo")} />
        </View>
        <View style={styles.price}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowAmount, { color: color.ink }]}
            accessibilityLabel={`Oracle price ${price18(line.price18, priceDecimalsOf(line.marketId))} dollars`}
          >
            ${price18(line.price18, priceDecimalsOf(line.marketId))}
          </Text>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.meta, { color: line.market.tickStale ? color.warn : color.text3 }]}
            numberOfLines={1}
          >
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: color.link }}>
              Market
            </Text>{" "}
            ·{" "}
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: statusTone(line.status, color) }}>
              {STATUS_LABEL[line.status]}
            </Text>{" "}
            · {line.market.tickStale ? "not live · " : ""}
            {ageLabel(line.updatedAt, BigInt(Date.now()) / MS_PER_SECOND)}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.sides}>
          {sideLocked ? (
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: tone(side) }]}>
              {side === "long" ? "Long" : "Short"}
            </Text>
          ) : (
            <Segmented options={SIDES} value={side} onChange={onSide} label="Side" tone={tone} />
          )}
        </View>
        <ModeCapsule compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.xs },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flex: 1, gap: SPACE.xxs },
  price: { alignItems: "flex-end", gap: SPACE.xxs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  sides: { flex: 1 },
});
