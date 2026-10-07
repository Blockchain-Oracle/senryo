import { notional } from "@senryo/core";
import { ids } from "@senryo/identity";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { PriceFreshness } from "~/features/markets/PriceFreshness";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { price18, priceDecimalsOf, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { Side } from "./useTicket";

const SIDES: readonly Side[] = ["long", "short"];
/** The side toggle is small (F37 has none; ours replaces the old full-width segmented control). */
const TOGGLE_HEIGHT = SIZE.chipHeight;

/**
 * The ticket's identity zone (Fomo F37; flow book C3 step 2; plan §0.9 Ticket): the market's art, its ticker over its
 * open interest, the live oracle price over "Market" — Senryo fills at the oracle price, so the order type is a label,
 * not a selector — with the session word when it isn't open and the price's age, warned when the socket is quiet
 * ("not live", D-020). Under it: a small Long / Short toggle that recolours the ticket (locked while a trade is in
 * flight), and the venue chip with the mode as plain words — neither is tappable here (Part F2).
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
  const shown = price18(line.price18, priceDecimalsOf(line.marketId));
  const openInterest = usd(notional(line.market.book.longSize + line.market.book.shortSize, line.price18), 0);
  const practice = network.key === "testnet";
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
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            {openInterest} OI
          </Text>
        </View>
        <View style={styles.price}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowAmount, { color: color.ink }]}
            accessibilityLabel={`Oracle price ${shown} dollars`}
          >
            ${shown}
          </Text>
          <PriceFreshness market={line.market} />
        </View>
      </View>
      <View style={styles.row}>
        <SideToggle side={side} onSide={onSide} locked={sideLocked} />
        <View style={styles.venue} accessible accessibilityLabel={`Senryo, ${practice ? "Practice" : "Mainnet"}`}>
          <VenueChip venue={ids.venue("senryo")} />
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.chipLabel, { color: practice ? color.practice : color.mainnet }]}
          >
            {practice ? "Practice" : "Mainnet"}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Long / Short in a small track; the chosen side fills with its wash and ink (C3a colours). The Perpl ticket shares it. */
export function SideToggle({ side, onSide, locked }: { side: Side; onSide: (side: Side) => void; locked: boolean }) {
  const { color } = useTheme();
  const tone = (s: Side) => (s === "long" ? color.up : color.down);
  const wash = (s: Side) => (s === "long" ? color.upWash : color.downWash);
  if (locked) {
    return (
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: tone(side) }]}>
        {side === "long" ? "Long" : "Short"}
      </Text>
    );
  }
  return (
    <View
      style={[styles.toggle, { backgroundColor: color.muted }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Side"
    >
      {SIDES.map((s) => {
        const on = s === side;
        return (
          <Pressable
            key={s}
            onPress={() => {
              if (on) return;
              fire("tick");
              onSide(s);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={s === "long" ? "Long" : "Short"}
            hitSlop={(SIZE.touch - TOGGLE_HEIGHT) / 2}
            style={[styles.cell, on ? { backgroundColor: wash(s) } : null]}
          >
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.chipCategory, { color: on ? tone(s) : color.text3 }]}
            >
              {s === "long" ? "Long" : "Short"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.xs },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flexGrow: 1, flexShrink: 0, gap: SPACE.xxs },
  price: { flexShrink: 1, alignItems: "flex-end", gap: SPACE.xxs },
  right: { textAlign: "right" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.md },
  venue: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  toggle: { flexDirection: "row", borderRadius: BUTTON.radius.sm, padding: SPACE.xxs, gap: SPACE.xxs },
  cell: {
    height: TOGGLE_HEIGHT - SPACE.xs,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm - SPACE.xxs,
    justifyContent: "center",
  },
});
