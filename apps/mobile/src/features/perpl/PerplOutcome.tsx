import { type PerplOrderOutcome, perplLiquidationPrice } from "@senryo/chain";
import { explorerTxUrl } from "@senryo/config";
import { usePerplMarketTerms } from "@senryo/query";
import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { DetailRow } from "~/features/markets/Disclosure";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { Facts } from "~/features/trade/TicketReceipt";
import { type SettledVerdict, TradeTrace } from "~/features/trade/TradeTrace";
import { fire } from "~/feedback/fire";
import { shortAddress } from "~/lib/format";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { perplPrice, perplSize, perplUsd } from "./format";
import { PERPL_CHAIN, type PerplMarketMeta } from "./market";
import { usePerplFill } from "./usePerplFill";
import type { PerplRunner } from "./usePerplRun";
import { openWords } from "./words";

const NOTHING_OPENED = "Price moved — nothing opened.";

/** The decoded fill's facts: what was opened, at what average price, and where it now liquidates. */
function fillFacts(
  fill: Extract<PerplOrderOutcome, { kind: "filled" | "partial" }>,
  meta: PerplMarketMeta,
  mmf: bigint | undefined,
) {
  const change = fill.position.findLast((p) => p.kind === "opened" || p.kind === "increased");
  const liq =
    change && (change.kind === "opened" || change.kind === "increased") && mmf !== undefined
      ? perplLiquidationPrice({
          side: change.side,
          entryPricePNS: change.entryPricePNS,
          lots: change.lotsAfter,
          depositCNS: change.depositCNS,
          premiumPnlCNS: 0n,
          maintMarginFracHdths: mmf,
          priceDecimals: meta.priceDecimals,
          lotDecimals: meta.lotDecimals,
        })
      : undefined;
  return [
    { label: "Size", value: perplSize(fill.filledLots, meta) },
    { label: "Entry", value: perplPrice(fill.avgPricePNS, meta) },
    {
      label: change?.kind === "increased" ? "Liq. (est.)" : "Liq.",
      value: liq === undefined ? "—" : liq === null ? "None" : perplPrice(liq, meta),
    },
  ];
}

/**
 * A Perpl open, end to end (flow book C4 steps 5–6; Part A8): the one outcome surface. While it runs the headline names
 * the step ("Approve AUSD · 1 of 3"); once the order finalized it reads the receipt and says only what the events show —
 * "Long BTC opened" with Size · Entry · Liq. for a fill (a part fill says how much), or "Price moved — nothing opened."
 * when the IOC matched nobody, with the AUSD left on Perpl and the way to move it back. A failure hands back to review
 * and never resends; an operation stopped after an earlier step says what remains; an unknown outcome offers nothing.
 */
export function PerplOpenOutcome({
  runner,
  meta,
  onDone,
  onLeave,
  onViewPosition,
  onMoveBack,
  onShare,
}: {
  runner: PerplRunner;
  meta: PerplMarketMeta;
  onDone: () => void;
  onLeave: () => void;
  onViewPosition: () => void;
  onMoveBack: () => void;
  onShare: () => void;
}) {
  const { color } = useTheme();
  const { trace, step, active } = runner;
  const record = trace.record;
  const intent = record?.reviewedIntent;
  const side = intent?.side === "short" ? "short" : "long";
  const outcome = useSettledOutcome(trace.events);
  const terms = usePerplMarketTerms(meta.marketId);
  const mmf = terms.status === "fresh" || terms.status === "stale" ? terms.value.maintMarginFracHdths : undefined;
  const { fill, failed, hash } = usePerplFill(record);
  const finalized = trace.events.some((e) => e.stage === "finalized");
  const allDone = record?.outcome === "completed";
  const moved = record?.steps.some(
    (s) => (s.action === "perplDeposit" || s.action === "perplCreateAccount") && s.outcome === "completed",
  );
  const words = openWords(side, meta.symbol);

  let title: string | undefined;
  let verdict: SettledVerdict | undefined;
  if (finalized && !allDone) {
    // A finalized approve or deposit with the order still to come — or, after a kill, stopped there.
    title = active ? step?.label : "Stopped before the order";
    verdict = active ? "reading" : "nothing";
  } else if (finalized && allDone) {
    if (fill === undefined && !failed) {
      title = "Reading the fill";
      verdict = "reading";
    } else if (fill === undefined || fill.kind === "no-order") {
      title = "Couldn’t read the fill";
      verdict = "nothing";
    } else if (fill.kind === "unfilled") {
      title = NOTHING_OPENED;
      verdict = "nothing";
    }
  } else if (trace.running && step && step.count > 1) {
    title = `${step.label} · ${step.index + 1} of ${step.count}`;
  }
  const filled = fill && (fill.kind === "filled" || fill.kind === "partial") ? fill : undefined;

  const unfilled = allDone && fill?.kind === "unfilled";
  const failedStep = outcome !== undefined && outcome !== "finalized" && outcome !== "unknown";
  // The AUSD is on Perpl whenever the IOC missed, or an earlier step of this operation moved it there.
  const moveBack =
    unfilled || (moved && (failedStep || verdict === "nothing")) ? (
      <LinkLine label="Your AUSD stays on Perpl" action="Move it back" onPress={onMoveBack} />
    ) : null;
  return (
    <TradeTrace
      events={trace.events}
      record={record}
      running={trace.running || active}
      outcome={outcome}
      onDone={onDone}
      onLeave={onLeave}
      words={words}
      {...(title ? { title } : {})}
      verdict={verdict}
      next={
        filled ? (
          <View style={styles.next}>
            <Button label="Share" variant="outline" style={styles.flex} onPress={onShare} />
            <Button label="View position" variant="secondary" style={styles.flex} onPress={onViewPosition} />
          </View>
        ) : null
      }
      details={
        intent ? (
          <View>
            <DetailRow label="Margin" value={perplUsd(BigInt(intent.marginUsd6 ?? "0"))} />
            <DetailRow label="Leverage" value={`${intent.leverage ?? "—"}×`} />
            {BigInt(intent.deposit ?? "0") > 0n ? (
              <DetailRow label="Moved to Perpl" value={perplUsd(BigInt(intent.deposit ?? "0"))} />
            ) : null}
            {intent.limitPricePNS ? (
              <DetailRow
                label="Acceptable price"
                value={`${side === "long" ? "≤" : "≥"} ${perplPrice(BigInt(intent.limitPricePNS), meta)}`}
              />
            ) : null}
            <DetailRow
              label={fill && fill.kind !== "no-order" ? "Fee" : "Fee (est.)"}
              value={perplUsd(fill && fill.kind !== "no-order" ? fill.feeCNS : BigInt(intent.feeUsd6 ?? "0"))}
            />
            {hash ? (
              <Button
                label={`Order ${shortAddress(hash)}`}
                variant="ghost"
                size="sm"
                onPress={() => void Linking.openURL(explorerTxUrl(PERPL_CHAIN, hash))}
              />
            ) : null}
          </View>
        ) : null
      }
    >
      {filled ? (
        <>
          <Facts facts={fillFacts(filled, meta, mmf)} />
          {filled.kind === "partial" ? (
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, styles.center, { color: color.text3 }]}>
              Part filled · {perplSize(filled.filledLots, meta)} of {perplSize(filled.requestedLots, meta)}
            </Text>
          ) : null}
        </>
      ) : (
        moveBack
      )}
    </TradeTrace>
  );
}

/** One quiet line with a link at the right ("Your AUSD stays on Perpl · Move it back ›"). */
export function LinkLine({
  label,
  action,
  onPress,
}: {
  label: string;
  action: string;
  onPress: () => void;
}): ReactNode {
  const { color } = useTheme();
  return (
    <View style={styles.line}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, styles.flex, { color: color.text2 }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        hitSlop={SPACE.sm}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.link }]}>
          {action} ›
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  next: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  center: { textAlign: "center" },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
});
