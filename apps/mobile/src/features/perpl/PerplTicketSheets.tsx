import { MAINNET_CHAIN_ID, PERPL_ORDER_TTL_BLOCKS, PERPL_SLIPPAGE_BPS } from "@senryo/config";
import { BPS_DENOMINATOR, DECIMALS, formatUnits } from "@senryo/core";
import { useDiscoveryQuote } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { DetailRow } from "~/features/markets/Disclosure";
import { pct } from "~/lib/money";
import { TYPE, useTheme } from "~/theme";
import { fundingForSide, liqDistanceBps, perplPrice, perplSize, perplUsd } from "./format";
import { perplWatchKey } from "./market";
import { PERPL_PRACTICE_REASON } from "./usePerplAccess";
import type { PerplTicketModel } from "./usePerplTicket";
import { feePct, stepLabel } from "./words";

const HDTHS_PER_X = 100n;
const PCT_SHOWN = 1;

/** 50 bps → "0.50%". */
const bpsPct = (bps: bigint) => `${formatUnits(bps, DECIMALS.bpsAsPct, DECIMALS.cents)}%`;
/** 2500 hundredths (25×) → "4.0%": a maintenance fraction as the share of the position it keeps. */
const maintPct = (hdths: bigint) =>
  `${formatUnits((BPS_DENOMINATOR * HDTHS_PER_X) / hdths, DECIMALS.bpsAsPct, PCT_SHOWN)}%`;

/**
 * Details (flow book C4 step 2; C3 step 5 grammar): the order's numbers as quiet rows — margin, size in the asset,
 * Perpl's mark and the acceptable price (mark ± 0.5 %, valid 20 blocks), the taker fee, funding now for this side and
 * the liquidation estimate — then the steps this operation sends ("Approve AUSD · Open Perpl account · $10.00 ·
 * Order"). With a screen reader on it also carries the explicit Open button the slide stands for.
 */
export function PerplDetails({
  open,
  onClose,
  t,
  canOpen,
  onOpen,
  screenReader,
}: {
  open: boolean;
  onClose: () => void;
  t: PerplTicketModel;
  canOpen: boolean;
  onOpen: () => void;
  screenReader: boolean;
}) {
  const quote = useDiscoveryQuote(perplWatchKey(t.meta.symbol));
  const known = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const long = t.side === "long";
  const plan = t.plan && !t.plan.blocker ? t.plan : undefined;
  const steps = plan ? plan.plannedActions.map((a) => stepLabel(a, plan.depositCNS)).join(" · ") : undefined;
  return (
    <ChildSheet
      open={open}
      onClose={onClose}
      title="Details"
      subtitle={`${long ? "Long" : "Short"} ${t.meta.symbol} · ${t.leverage}× · Perpl`}
    >
      <View>
        <DetailRow label="Margin" value={perplUsd(t.amountUsd6)} />
        <DetailRow label="Leveraged size" value={perplUsd(t.sizedUsd6)} />
        {t.lots > 0n ? <DetailRow label="Quantity" value={perplSize(t.lots, t.meta)} /> : null}
        {t.terms ? <DetailRow label="Mark price" value={perplPrice(t.terms.markPNS, t.meta)} /> : null}
        {t.limitPricePNS !== undefined ? (
          <DetailRow
            label="Acceptable price"
            value={`${long ? "≤" : "≥"} ${perplPrice(t.limitPricePNS, t.meta)} · ${PERPL_ORDER_TTL_BLOCKS} blocks`}
          />
        ) : null}
        <DetailRow label="Slippage" value={bpsPct(PERPL_SLIPPAGE_BPS)} />
        {t.terms ? (
          <DetailRow label="Fee (taker)" value={`${perplUsd(t.feeUsd6)} · ${feePct(t.terms.takerFeePpm)}`} />
        ) : null}
        {known?.funding.available ? (
          <DetailRow label="Funding now" value={fundingForSide(known.funding.value, t.side)} />
        ) : null}
        {t.lots > 0n ? (
          <DetailRow
            label="Liquidation (est.)"
            value={t.liqPricePNS === null ? "None" : perplPrice(t.liqPricePNS, t.meta)}
          />
        ) : null}
        {steps ? <DetailRow label="Steps" value={steps} /> : null}
        <DetailRow label="Venue" value={`Perpl · ${t.meta.chainId === MAINNET_CHAIN_ID ? "Mainnet" : "Practice"}`} />
      </View>
      {screenReader ? <Button label={`Open ${t.side}`} disabled={!canOpen} onPress={onOpen} /> : null}
      <Button label="Back to order" variant="ghost" onPress={onClose} />
    </ChildSheet>
  );
}

/**
 * Liquidation info (F43; flow book C3a): what the price means for the side being entered, in Perpl's terms — the
 * market's maintenance margin, closed on the book at that point, 80 % of what remains returned (Perpl docs
 * exchange/liquidation) — with this order's own estimate when there is one.
 */
export function PerplLiquidationInfo({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: PerplTicketModel;
}) {
  const { color } = useTheme();
  const long = t.side === "long";
  const away = t.terms ? liqDistanceBps(t.terms.markPNS, t.liqPricePNS, t.side) : null;
  return (
    <ChildSheet open={open} onClose={onClose} title="Liquidation price">
      <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>
        If {t.meta.symbol}’s mark {long ? "falls" : "rises"} to this price, Perpl closes the position on its order book.
        {t.terms
          ? ` That happens when the margin left reaches ${maintPct(t.terms.maintMarginFracHdths)} of the position.`
          : ""}{" "}
        About 80% of what remains comes back to you. It moves as funding is paid or received.
      </Text>
      {t.liqPricePNS !== null && away !== null && t.lots > 0n ? (
        <DetailRow
          label={`${long ? "Long" : "Short"} ${t.leverage}×`}
          value={`~${perplPrice(t.liqPricePNS, t.meta)} · ${pct(away < 0n ? -away : away)} away`}
        />
      ) : null}
      <Button label="Close" variant="secondary" onPress={onClose} />
    </ChildSheet>
  );
}

/** Explain why a ticket must be reviewed after a network change. */
export function PerplPracticeInfo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { color } = useTheme();
  return (
    <ChildSheet open={open} onClose={onClose} title="Review network">
      <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{PERPL_PRACTICE_REASON}</Text>
      <Button label="Close" variant="secondary" onPress={onClose} />
    </ChildSheet>
  );
}

const styles = StyleSheet.create({ center: { textAlign: "center" } });
