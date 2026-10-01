import type { DecreasePreview } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { STATUS_CHIP } from "~/features/markets/session";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { REDUCE_ALL_BPS, REDUCE_STEPS_BPS } from "./constants";

const MS_PER_SECOND = 1000n;
const STEP_LABEL = (bps: bigint) => (bps >= REDUCE_ALL_BPS ? "All" : pct(bps));

/**
 * The close ticket's body (F11/F12): how much to close — 25 / 50 / 75 % / All — and the quote for that share: exit
 * price, realised P&L (marked when the profit cap applies), fee and what reaches the balance. One borderless filled
 * group. Reducing works in every session status (closed and paused markets use the status-matrix price, stated here),
 * and a profitable close waits out the anti-flash blocks, stated with the seconds left. The hold that sends it is
 * `CloseBar`, pinned under the scroll.
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
    <Panel style={styles.panel}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        Close
      </Text>
      <Segmented
        options={REDUCE_STEPS_BPS.map((b) => ({ value: String(b), label: STEP_LABEL(b) }))}
        value={String(shareBps)}
        onChange={(v) => onShare(BigInt(v))}
        label="How much to close"
      />
      {reduce ? (
        <View>
          <KeyValue label="Exit price" value={price18(reduce.execPrice18, decimals)} />
          <KeyValue
            label={reduce.profitCapped ? "Realised · capped" : "Realised"}
            value={signedUsd(reduce.realizedPnlUsd6)}
          />
          <KeyValue label="Fee" value={usd(reduce.feeUsd6)} />
          <KeyValue label="To your balance" value={signedUsd(reduce.netUsd6)} />
        </View>
      ) : null}
      {market.pv.status !== "OPEN" ? (
        <Text style={[TYPE.rowDetail, { color: color.warn }]}>
          {market.name} is {STATUS_CHIP[market.pv.status].toLowerCase()}: closing still works, at the conservative
          price.
        </Text>
      ) : null}
      {waitMs !== undefined && waitMs > 0n ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          Profit close available in about {(waitMs + MS_PER_SECOND - 1n) / MS_PER_SECOND}s (anti-flash wait).
        </Text>
      ) : null}
    </Panel>
  );
}

/**
 * The sticky action (Fomo F13/F14's pinned "Deposit to buy"): the hold-to-confirm sits under the scroll, above the
 * home indicator, on the page's own ground — so it is never cut off by the content and never covers it.
 */
export function CloseBar({ label, disabled, onConfirm }: { label: string; disabled: boolean; onConfirm: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + SPACE.sm, backgroundColor: color.ground }]}>
      <HoldToConfirm
        label={label}
        disabled={disabled}
        onConfirm={onConfirm}
        accessibilityHint="Hold for half a second to close"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  bar: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
});
