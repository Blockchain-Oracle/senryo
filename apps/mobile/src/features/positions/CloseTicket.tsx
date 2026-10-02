import type { DecreasePreview } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChipRow } from "~/components/kit/ChipRow";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { DetailRow } from "~/features/markets/Disclosure";
import { STATUS_LABEL } from "~/features/markets/session";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { REDUCE_ALL_BPS, REDUCE_STEPS_BPS } from "./constants";

const MS_PER_SECOND = 1000n;
const STEP_LABEL = (bps: bigint) => (bps >= REDUCE_ALL_BPS ? "100%" : pct(bps));

/**
 * Reduce (flow book C5 step 6; plan §0.9 Position): 25 / 50 / 75 / 100 % as chips, and the quote for that share —
 * exit price, realised P&L ("Realised · capped" when the profit cap applies), fee and what reaches the balance. A
 * closed or paused market still closes, at the status-matrix price (said in one line); a profitable reduce waits out
 * the anti-flash blocks ("Profit close in ~6s"). Rows, not boxes. The slide that sends it is `CloseBar`, pinned.
 */
export function CloseTicket({
  market,
  shareBps,
  onShare,
  reduce,
  waitMs,
}: {
  market: LiveMarket;
  shareBps: bigint;
  onShare: (bps: bigint) => void;
  reduce: DecreasePreview | undefined;
  /** How long until a profitable close is allowed; undefined when there is no wait. */
  waitMs: bigint | undefined;
}) {
  const { color } = useTheme();
  const decimals = priceDecimalsOf(market.marketId);
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        Reduce
      </Text>
      <View style={styles.chips}>
        <ChipRow
          options={REDUCE_STEPS_BPS.map((b) => ({ value: String(b), label: STEP_LABEL(b) }))}
          value={String(shareBps)}
          onChange={(v) => onShare(BigInt(v))}
          label="How much to close"
        />
      </View>
      {reduce ? (
        <View>
          <DetailRow label="Exit price" value={`$${price18(reduce.execPrice18, decimals)}`} />
          <DetailRow
            label={reduce.profitCapped ? "Realised · capped" : "Realised"}
            value={signedUsd(reduce.realizedPnlUsd6)}
            tone={reduce.realizedPnlUsd6 < 0n ? color.down : color.up}
          />
          <DetailRow label="Fee" value={usd(reduce.feeUsd6)} />
          <DetailRow label="To balance" value={signedUsd(reduce.netUsd6)} />
        </View>
      ) : null}
      {market.pv.status !== "OPEN" ? (
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.warn }]}>
          Market {STATUS_LABEL[market.pv.status].toLowerCase()} · closing works at the closed spread
        </Text>
      ) : null}
      {waitMs !== undefined && waitMs > 0n ? (
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
          Profit close in ~{(waitMs + MS_PER_SECOND - 1n) / MS_PER_SECOND}s
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The pinned slide (Fomo F13/F14's pinned action): "Slide to close" or "Slide to reduce 25%", in the position's side
 * colour, on the page's own ground above the home indicator. Reduce and close are never session-capped.
 */
export function CloseBar({
  label,
  disabled,
  isLong,
  resetKey,
  onConfirm,
}: {
  label: string;
  disabled: boolean;
  isLong: boolean;
  resetKey: string;
  onConfirm: () => void;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + SPACE.sm, backgroundColor: color.ground }]}>
      <SlideToConfirm
        label={label}
        disabled={disabled}
        tone={isLong ? "up" : "down"}
        resetKey={resetKey}
        onConfirm={onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  chips: { marginHorizontal: -SIZE.gutter },
  bar: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
});
