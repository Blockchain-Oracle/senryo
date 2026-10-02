import { engineMarket } from "@senryo/config";
import { useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "~/components/kit/states";
import { TransactionSheet, useTransactionClose } from "~/components/sheet/TransactionSheet";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { useMarketLine } from "~/features/markets/useMarketLine";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { useAccount } from "~/lib/account/provider";
import { positionRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE } from "~/theme";
import { ProtectAfterOpen } from "./ProtectAfterOpen";
import { planKey } from "./planned-triggers";
import { useSettledOutcome } from "./send-outcome";
import { type EntryMode, type TicketChild, TicketEntry } from "./Ticket";
import { CandleSettings, LiquidationInfo, ReviewOrder } from "./TicketChildren";
import { TicketFooter } from "./TicketFooter";
import { TicketHeader } from "./TicketHeader";
import { restoredOrder, SharePreview, type SubmittedOrder, TicketReceipt } from "./TicketReceipt";
import { TpSlChild } from "./TpSlChild";
import { TradeTrace } from "./TradeTrace";
import { commitState } from "./ticket-commit";
import { type Side, useTicket } from "./useTicket";

const PRICE_UPDATED = "Price updated. Review and slide again.";
const UPDATES_PAUSED = "Live updates paused. Review the latest oracle price.";

/**
 * J4, the order ticket (C39–C43, M14, FT102–FT111): a full-height transaction sheet over market detail, opened on a
 * side from the sticky Short / Long. The dock hides while it is focused. Money logic is the existing `useTicket`
 * (draft per (mode, market), core preview, blocker chain, gas top-up, send trace) — unchanged; this lays it out in
 * Fomo's anatomy. Children (liquidation info, TP/SL, review, candle settings, share) rise over the ticket and return to
 * it with every value kept (FT112); dismissing the ticket restores market detail.
 */
export function TicketScreen({ marketId, side }: { marketId: string; side: Side | undefined }) {
  useHideDockWhileFocused("ticket");
  const meta = engineMarket(marketId);
  const readOnly = useReadOnlyNetwork();
  return readOnly || !meta ? (
    <TransactionSheet onClose={() => router.back()} closeLabel="Close the order ticket">
      <View style={styles.pad}>
        {readOnly ? (
          <PrelaunchMainnet surface="trade" />
        ) : (
          <EmptyState why={`${marketId} isn't tradable here yet`} detail="This market isn't listed on this network." />
        )}
      </View>
    </TransactionSheet>
  ) : (
    <LoadedTicket marketId={meta.id} symbol={meta.symbol} side={side} />
  );
}

function LoadedTicket({ marketId, symbol, side }: { marketId: number; symbol: string; side: Side | undefined }) {
  const line = useMarketLine(marketId, symbol);
  const client = useQueryClient();
  if (line.status === "unknown" || line.status === "failed") {
    return (
      <TransactionSheet onClose={() => router.back()} closeLabel="Close the order ticket">
        <View style={styles.pad}>
          {line.status === "failed" ? (
            <ErrorState diagnosis={line.error} retry={() => void client.invalidateQueries()} />
          ) : (
            <LoadingState shape="plate" label="Reading the oracle" />
          )}
        </View>
      </TransactionSheet>
    );
  }
  return <TicketBody line={line.value} initialSide={side} />;
}

function TicketBody({ line, initialSide }: { line: MarketLine; initialSide: Side | undefined }) {
  const t = useTicket(line.market);
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const [mode, setMode] = useState<EntryMode>("keypad");
  const [child, setChild] = useState<TicketChild | "share" | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const [submitted, setOrder] = useState<SubmittedOrder | undefined>();
  const order = submitted ?? restoredOrder(t.trace.record);
  const sided = useRef(false);
  const plan = planKey(env.chainId, account.hint?.address, line.marketId);

  // Short / Long on market detail picks the side once; the draft keeps everything else (amount, leverage).
  useEffect(() => {
    if (sided.current || !initialSide) return;
    sided.current = true;
    if (initialSide !== t.side) t.setSide(initialSide);
  }, [initialSide, t]);

  const inFlight = t.trace.events.length > 0;
  const settled = t.trace.events.some((e) => e.stage === "finalized");
  const commit = commitState({
    side: t.side,
    amountUsd6: t.amountUsd6,
    blocker: t.blocker,
    gasStep: t.gasStep,
    hasAccount: t.hasAccount,
    ready: t.ready,
    previewReady: t.preview !== undefined,
    confirmWith: t.confirmWith,
  });
  // The order's identity at the hold: any change while holding resets it (Codex S1b.7 consult #3).
  const resetKey = [
    env.chainId,
    line.marketId,
    account.hint?.address ?? "",
    t.side,
    t.confirmWith,
    t.amountText,
    t.leverage,
    t.preview?.execPrice18 ?? "",
    line.market.tickStale ? "paused" : "live",
  ].join("|");

  const confirm = () => {
    setChild(undefined);
    setNote(undefined);
    if (!(storage.getBoolean(STORAGE_KEYS.riskExplained) ?? false)) {
      router.push(ROUTES.riskExplainer);
      return;
    }
    if (t.preview) {
      setOrder({
        network: network.key,
        chainId: env.chainId,
        marketId: line.marketId,
        symbol: line.symbol,
        side: t.side,
        leverage: t.leverage,
        marginUsd6: t.amountUsd6,
        lockedUsd6: t.preview.marginUsd6,
        notionalUsd6: t.notionalUsd6,
        execPrice18: t.preview.execPrice18,
        feeUsd6: t.preview.feeUsd6,
        sizeDelta: t.preview.sizeDelta,
      });
    }
    if (commit.retryGas) t.resetGas();
    void t.submit();
  };

  return (
    <View style={styles.fill}>
      <TransactionSheet
        onClose={() => {
          // Closing after a finished trade starts the next ticket clean; a draft or an unresolved trace is kept.
          if (settled) t.trace.reset();
          router.back();
        }}
        closeLabel="Close the order ticket"
        locked={t.trace.running}
        header={
          <TicketHeader
            line={line}
            side={t.side}
            onSide={(s) => {
              setNote(undefined);
              t.setSide(s);
            }}
            sideLocked={inFlight}
          />
        }
      >
        {inFlight ? (
          settled && order ? (
            <Receipt
              order={order}
              t={t}
              onShare={() => setChild("share")}
              marketId={line.marketId}
              protection={
                <ProtectAfterOpen
                  market={line.market}
                  position={t.held}
                  planKey={plan}
                  operationId={t.trace.record?.id}
                  auto={!t.trace.restored}
                />
              }
            />
          ) : (
            <PendingTrace t={t} />
          )
        ) : (
          <>
            <TicketEntry t={t} line={line} mode={mode} onMode={setMode} onChild={setChild} planKey={plan} />
            <TicketFooter
              t={t}
              line={line}
              commit={commit}
              note={note}
              resetKey={resetKey}
              onReset={() => setNote(line.market.tickStale ? UPDATES_PAUSED : PRICE_UPDATED)}
              onConfirm={confirm}
              onReview={() => setChild("review")}
            />
          </>
        )}
      </TransactionSheet>
      <LiquidationInfo open={child === "liquidation"} onClose={() => setChild(undefined)} t={t} line={line} />
      <TpSlChild
        open={child === "tpsl"}
        onClose={() => setChild(undefined)}
        market={line.market}
        held={t.held}
        isLong={t.side === "long"}
        previewLiq={t.preview ? t.preview.liqPrice18 : undefined}
        planKey={plan}
      />
      <ReviewOrder
        open={child === "review"}
        onClose={() => setChild(undefined)}
        t={t}
        line={line}
        canOpen={commit.holdable}
        onOpen={confirm}
      />
      <CandleSettings open={child === "candles"} onClose={() => setChild(undefined)} />
      {order ? (
        <SharePreview
          open={child === "share"}
          onClose={() => setChild(undefined)}
          order={order}
          hash={t.trace.events.find((e) => e.hash)?.hash}
        />
      ) : null}
    </View>
  );
}

/**
 * The trace while the order runs or after it failed. Leaving closes the sheet and keeps the trace (it is keyed outside
 * React), so the order continues and reopening the ticket shows where it got to; nothing is cancelled or resent.
 */
function PendingTrace({ t }: { t: ReturnType<typeof useTicket> }) {
  const close = useTransactionClose();
  const outcome = useSettledOutcome(t.trace.events);
  return (
    <View style={styles.pad}>
      <TradeTrace
        record={t.trace.record}
        events={t.trace.events}
        running={t.trace.running}
        outcome={outcome}
        onDone={() => t.trace.reset()}
        onLeave={() => close()}
      />
    </View>
  );
}

/** After finalized: the receipt; Done resets the trace and closes; View position closes, then opens the position. */
function Receipt({
  order,
  t,
  onShare,
  marketId,
  protection,
}: {
  order: SubmittedOrder;
  t: ReturnType<typeof useTicket>;
  onShare: () => void;
  marketId: number;
  protection: ReactNode;
}) {
  const close = useTransactionClose();
  return (
    <TicketReceipt
      order={order}
      events={t.trace.events}
      record={t.trace.record}
      onShare={onShare}
      protection={protection}
      onDone={() =>
        close(() => {
          t.trace.reset();
        })
      }
      onViewPosition={() =>
        close(() => {
          t.trace.reset();
          router.push(positionRoute(String(marketId)));
        })
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.md },
});
