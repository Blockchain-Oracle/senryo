/**
 * The swap's review (B6 step 4; a child sheet over the ticket, so the ticket's values and the review guard stay): pay
 * mark → receive mark, the exact amount paid, the minimum received (what the swap is sent with), the estimate, the
 * rate and impact, the route with its provider's mark, the network fee and the steps; then the slide. The slide's
 * `resetKey` is the reviewed intent (minimum included), so a changed quote can never ride a slide in progress.
 */
import { ids } from "@senryo/identity";
import { stepsLine } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { AssetMark } from "~/features/money/AssetMark";
import { amountOf, exactAmount } from "~/features/money/format";
import { MoveLine, ReviewRow, ReviewRows } from "~/features/money/Review";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { hopsText, impactText, monFee, rateText, swapProviderName } from "./swap-format";
import type { SwapState } from "./useSwap";

export function SwapReview({ s, busy, onConfirm }: { s: SwapState; busy: boolean; onConfirm: () => void }) {
  const { color } = useTheme();
  const r = s.reviewed;
  if (!r) return null;
  const q = r.quote;
  const provider = swapProviderName(q.quote.provider);
  const impactTone = q.quote.impact === "ok" ? undefined : "warn";
  const resetKey = [r.pay.key, r.receive.key, r.amount, q.quote.minOut, q.quote.router].join(":");
  return (
    <View style={styles.stack}>
      <MoveLine
        from={<AssetMark asset={r.pay} size={SIZE.markDetail} />}
        to={<AssetMark asset={r.receive} size={SIZE.markDetail} />}
        fromLabel={r.pay.symbol}
        toLabel={r.receive.symbol}
      />
      <ReviewRows>
        <ReviewRow label="You pay" value={exactAmount(r.pay, r.amount)} />
        <ReviewRow label="You receive at least" value={amountOf(r.receive, q.quote.minOut)} />
        <ReviewRow label="Estimate" value={amountOf(r.receive, q.quote.amountOut)} />
        <ReviewRow label="Rate" value={rateText(q)} />
        <ReviewRow label="Price impact" value={impactText(q)} tone={impactTone} />
        <ReviewRow
          label="Route"
          value={`${provider} · ${hopsText(q)}`}
          mark={<EntityMark id={ids.provider(q.quote.provider)} label={provider} size={SIZE.markChip} decorative />}
        />
        <ReviewRow label="Network fee" value={`≈ ${monFee(r.feeWei)}`} />
        <ReviewRow label="Steps" value={stepsLine(r.steps)} />
      </ReviewRows>
      {!r.pay.verified ? (
        <Text style={[TYPE.rowDetail, { color: color.warn }]}>Unverified token · sell only</Text>
      ) : null}
      <SlideToConfirm
        label={`Slide to swap ${r.pay.symbol}`}
        tone="primary"
        busy={busy}
        resetKey={resetKey}
        onConfirm={onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg, paddingBottom: SPACE.sm },
});
