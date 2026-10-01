/**
 * The ticket's live numbers (F10 step 3): notional, fee, margin, FROM FREE·TRADE → AFTER, liquidation price and how far
 * away it is, beside the margin gauge. All from the `@senryo/core` preview (the contract re-checks at send).
 */
import type { IncreasePreview } from "@senryo/core";
import { StyleSheet, View } from "react-native";
import { KeyValue } from "~/components/kit/Surface";
import { MarginGauge } from "~/components/trade/MarginGauge";
import { pct, price18, usd } from "~/lib/money";
import { SPACE, useTheme } from "~/theme";

const GAUGE_WIDTH = 132;

export function TicketSummary({
  notionalUsd6,
  preview,
  freeToTradeUsd6,
  feeBps,
  priceDecimals,
}: {
  notionalUsd6: bigint;
  preview: IncreasePreview | undefined;
  freeToTradeUsd6: bigint | undefined;
  feeBps: bigint;
  /** The market's display precision (`priceDecimalsOf`). */
  priceDecimals: number;
}) {
  const { color } = useTheme();
  const after = preview?.freeToTradeAfter;
  const liq = preview?.liqPrice18;
  const away = preview?.liqDistanceBps;
  const liqText =
    liq === null || liq === undefined
      ? preview
        ? "none above $0"
        : "—"
      : `${price18(liq, priceDecimals)}${away === null || away === undefined ? "" : ` · ${pct(away < 0n ? -away : away)} ${away < 0n ? "past" : "away"}`}`;
  return (
    <View style={styles.row}>
      <View style={styles.rows}>
        <KeyValue label="NOTIONAL" value={usd(notionalUsd6)} />
        <KeyValue label={`FEE ${feeBps} BPS`} value={preview ? usd(preview.feeUsd6) : "—"} />
        <KeyValue label="MARGIN" value={preview ? usd(preview.marginUsd6) : "—"} />
        <KeyValue label="FREE·TRADE" value={freeToTradeUsd6 === undefined ? "—" : usd(freeToTradeUsd6)} />
        <KeyValue
          label="AFTER"
          value={after === undefined ? "—" : usd(after)}
          valueColor={after !== undefined && after < 0n ? color.down : undefined}
        />
        <KeyValue
          label="LIQ"
          value={liqText}
          valueColor={away !== undefined && away !== null && away < 0n ? color.down : undefined}
        />
      </View>
      <MarginGauge usageBps={preview?.marginUsageBps ?? 0n} width={GAUGE_WIDTH} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.md },
  rows: { flex: 1, gap: SPACE.xs },
});
