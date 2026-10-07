import { useDiscoveryQuote } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { Skeleton } from "~/components/kit/states";
import { ageLabel } from "~/features/markets/session";
import { useNowSec } from "~/features/markets/useNowSec";
import { compactUsd6 } from "~/features/tokens/format";
import { SideToggle } from "~/features/trade/TicketHeader";
import type { Side } from "~/features/trade/useTicket";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { perplPrice } from "./format";
import { perplWatchKey } from "./market";
import type { PerplTicketModel } from "./usePerplTicket";

const PRICE_SKELETON = 96;

/**
 * The Perpl ticket's identity zone (Fomo F37; flow book C4 step 1, Part F2): the market's mark with Perpl's badge,
 * the ticker over its open interest (one side, as Perpl states it), Perpl's mark price over "Market" and its age —
 * the order is an IOC at that mark ± 0.5 %, so the type is a label, not a selector. Under it the Long / Short toggle
 * (locked while an order runs) and the venue and mode as plain words: Perpl · Mainnet, neither tappable.
 */
export function PerplTicketHeader({
  t,
  onSide,
  sideLocked,
}: {
  t: PerplTicketModel;
  onSide: (side: Side) => void;
  sideLocked: boolean;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const now = useNowSec();
  const quote = useDiscoveryQuote(perplWatchKey(t.meta.symbol));
  const known = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const oi = known?.openInterest.available ? compactUsd6(known.openInterest.value.usd6) : undefined;
  const mark = t.terms ? perplPrice(t.terms.markPNS, t.meta) : undefined;
  const mode = network.key === "mainnet" ? "Mainnet" : "Practice";
  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <EntityMark id={t.meta.mark} badge={t.meta.venueMark} size={SIZE.markDetail} label={t.meta.symbol} decorative />
        <View style={styles.titles}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.sectionTitle, { color: color.ink }]}
            accessibilityLabel={`${t.meta.name}, ${t.meta.symbol}`}
          >
            {t.meta.symbol}
          </Text>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            {oi ? `${oi} OI` : t.meta.name}
          </Text>
        </View>
        <View style={styles.price}>
          {mark ? (
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.rowAmount, { color: color.ink }]}
              accessibilityLabel={`Perpl mark price ${mark}`}
            >
              {mark}
            </Text>
          ) : (
            <Skeleton width={PRICE_SKELETON} />
          )}
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.meta, styles.right, { color: t.terms?.paused ? color.warn : color.text3 }]}
          >
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: color.link }}>
              Market
            </Text>
            {t.terms ? ` · ${t.terms.paused ? "paused" : ageLabel(BigInt(t.terms.markTimestamp), now)}` : ""}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <SideToggle side={t.side} onSide={onSide} locked={sideLocked} />
        <View style={styles.venue} accessible accessibilityLabel={`Perpl, ${mode}`}>
          <VenueChip venue={t.meta.venueMark} />
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.chipLabel, { color: color.mainnet }]}>
            {mode}
          </Text>
        </View>
      </View>
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
});
