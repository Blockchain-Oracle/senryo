import { ENGINE_MARKETS } from "@senryo/config";
import type { OperationRecord, TraceEvent, TraceOutcome } from "@senryo/query";
import { Text } from "react-native";
import { DetailRow } from "~/features/markets/Disclosure";
import { Facts } from "~/features/trade/TicketReceipt";
import { ORDER_WORDS, TradeTrace } from "~/features/trade/TradeTrace";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, TYPE, useTheme } from "~/theme";
import type { ReduceQuote } from "./usePosition";

/**
 * A close or reduce, end to end (flow book C5 step 7; Part A8): the one outcome surface in its own words — "Closing XAU
 * long" while it runs, then "XAU long closed" / "Reduced by 25%" with Realised · Fee · To balance from the fill event
 * once read (quoted values until then, labelled). A full close also cancels the market's leftover TP/SL as later
 * steps of the same operation; their result is one line under the facts. Failures hand back to review, never resend.
 */
export function CloseOutcome({
  marketId,
  quote,
  events,
  record,
  running,
  outcome,
  cleanup,
  onDone,
  onLeave,
}: {
  marketId: number;
  quote: ReduceQuote | undefined;
  events: readonly TraceEvent[];
  record: OperationRecord | undefined;
  running: boolean;
  outcome: TraceOutcome | undefined;
  cleanup: { running: boolean; failed: number; cancels: number };
  onDone: () => void;
  onLeave: () => void;
}) {
  const { color } = useTheme();
  const symbol = ENGINE_MARKETS.find((m) => m.id === marketId)?.symbol ?? "";
  const side = quote?.isLong ? "long" : "short";
  const settled = events.some((e) => e.stage === "finalized");
  const fill = record?.steps
    .flatMap((s) => s.facts ?? [])
    .find((f) => f.event === "PositionUpdated" && f.values.marketId === String(marketId))?.values;
  const realised = fill ? BigInt(fill.realizedPnl ?? "0") : quote?.realizedPnlUsd6;
  const fee = fill ? BigInt(fill.fee ?? "0") : quote?.feeUsd6;
  const net = fill
    ? BigInt(fill.realizedPnl ?? "0") -
      BigInt(fill.fee ?? "0") -
      BigInt(fill.funding ?? "0") -
      BigInt(fill.borrow ?? "0")
    : quote?.netUsd6;
  const words = quote
    ? {
        ...ORDER_WORDS,
        thing: quote.closingAll ? "close" : "reduce",
        pending: quote.closingAll ? `Closing ${symbol} ${side}` : `Reducing ${symbol} ${side}`,
        success: quote.closingAll ? `${symbol} ${side} closed` : `Reduced by ${pct(quote.shareBps)}`,
        back: "Back to position",
      }
    : ORDER_WORDS;
  const est = fill ? "" : " (est.)";
  return (
    <TradeTrace
      events={events}
      record={record}
      running={running}
      outcome={outcome}
      onDone={onDone}
      onLeave={onLeave}
      words={words}
      details={
        quote ? (
          <DetailRow
            label={`Exit price${est}`}
            value={`$${price18(fill?.execPrice ? BigInt(fill.execPrice) : quote.execPrice18, priceDecimalsOf(marketId))}`}
          />
        ) : null
      }
    >
      {settled && realised !== undefined && fee !== undefined && net !== undefined ? (
        <>
          <Facts
            facts={[
              { label: `Realised${est}`, value: signedUsd(realised) },
              { label: `Fee${est}`, value: usd(fee) },
              { label: `To balance${est}`, value: signedUsd(net) },
            ]}
          />
          {cleanup.cancels > 0 ? (
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              accessibilityLiveRegion="polite"
              style={[TYPE.meta, { color: cleanup.failed > 0 ? color.warn : color.text3, textAlign: "center" }]}
            >
              {cleanup.running
                ? "Cancelling leftover TP/SL…"
                : cleanup.failed > 0
                  ? `${cleanup.failed} leftover ${cleanup.failed === 1 ? "level" : "levels"} still active · see Orders`
                  : "Leftover TP/SL cancelled"}
            </Text>
          ) : null}
        </>
      ) : null}
    </TradeTrace>
  );
}
