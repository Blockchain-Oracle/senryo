import { explorerTxUrl } from "@senryo/config";
import { Linking, StyleSheet, Text } from "react-native";
import { Button } from "~/components/kit/Button";
import { DetailRow } from "~/features/markets/Disclosure";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { Facts } from "~/features/trade/TicketReceipt";
import { type SettledVerdict, TradeTrace } from "~/features/trade/TradeTrace";
import { shortAddress } from "~/lib/format";
import { pct } from "~/lib/money";
import { CONTROL_FONT_SCALE, TYPE, useTheme } from "~/theme";
import { perplPrice, perplSignedUsd, perplSize, perplUsd } from "./format";
import { PERPL_CHAIN, type PerplMarketMeta } from "./market";
import { LinkLine } from "./PerplOutcome";
import { usePerplFill } from "./usePerplFill";
import type { PerplRunner } from "./usePerplRun";
import { CLOSE_WORDS } from "./words";

/**
 * A Perpl reduce or close, end to end (flow book C5 step 7): "Closing BTC long" while it runs, then — from the
 * receipt's events only — "BTC long closed" / "Reduced by 25%" with Exit · Realised · Fee, a part fill said as such,
 * or "Price moved — nothing closed." when the IOC matched nobody. What the close freed stays on Perpl until it is
 * moved back (one link). A failure hands back to the position and never resends.
 */
export function PerplCloseOutcome({
  runner,
  meta,
  onDone,
  onLeave,
  onMoveBack,
}: {
  runner: PerplRunner;
  meta: PerplMarketMeta;
  onDone: () => void;
  onLeave: () => void;
  onMoveBack: () => void;
}) {
  const { color } = useTheme();
  const { trace, active } = runner;
  const record = trace.record;
  const intent = record?.reviewedIntent;
  const side = intent?.side === "short" ? "short" : "long";
  const closingAll = intent?.closingAll === "true";
  const share = BigInt(intent?.shareBps ?? "0");
  const outcome = useSettledOutcome(trace.events);
  const { fill, failed, hash, retry } = usePerplFill(record);
  const allDone = record?.outcome === "completed";
  const words = {
    ...CLOSE_WORDS,
    pending: closingAll ? `Closing ${meta.symbol} ${side}` : `Reducing ${meta.symbol} ${side}`,
    success: closingAll ? `${meta.symbol} ${side} closed` : `Reduced by ${pct(share)}`,
  };
  let title: string | undefined;
  let verdict: SettledVerdict | undefined;
  if (allDone) {
    if (fill === undefined && !failed) {
      title = "Reading the fill";
      verdict = "reading";
    } else if (fill === undefined || fill.kind === "no-order") {
      title = "Couldn’t read the fill yet";
      verdict = "unread";
    } else if (fill.kind === "unfilled") {
      title = "Price moved — nothing closed.";
      verdict = "nothing";
    }
  }
  const filled = fill && (fill.kind === "filled" || fill.kind === "partial") ? fill : undefined;
  const realised = filled?.position.reduce(
    (sum, p) => (p.kind === "decreased" || p.kind === "closed" || p.kind === "inverted" ? sum + p.realizedPnlCNS : sum),
    0n,
  );
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
      details={
        intent ? (
          <>
            {intent.limitPricePNS ? (
              <DetailRow
                label="Acceptable price"
                value={`${side === "long" ? "≥" : "≤"} ${perplPrice(BigInt(intent.limitPricePNS), meta)}`}
              />
            ) : null}
            {hash ? (
              <Button
                label={`Order ${shortAddress(hash)}`}
                variant="ghost"
                size="sm"
                onPress={() => void Linking.openURL(explorerTxUrl(PERPL_CHAIN, hash))}
              />
            ) : null}
          </>
        ) : null
      }
    >
      {filled ? (
        <>
          <Facts
            facts={[
              { label: "Exit", value: perplPrice(filled.avgPricePNS, meta) },
              { label: "Realised", value: perplSignedUsd(realised ?? 0n) },
              { label: "Fee", value: perplUsd(filled.feeCNS) },
            ]}
          />
          {filled.kind === "partial" ? (
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, styles.center, { color: color.text3 }]}>
              Part closed · {perplSize(filled.filledLots, meta)} of {perplSize(filled.requestedLots, meta)}
            </Text>
          ) : null}
          <LinkLine label="Freed AUSD stays on Perpl" action="Move it back" onPress={onMoveBack} />
        </>
      ) : allDone && (failed || fill?.kind === "no-order") ? (
        <LinkLine label="It may have filled" action="Read again" onPress={retry} />
      ) : null}
    </TradeTrace>
  );
}

const styles = StyleSheet.create({ center: { textAlign: "center" } });
