import { explorerTxUrl } from "@senryo/config";
import { type Href, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Share, StyleSheet, View } from "react-native";
import { TransactionSheet, useTransactionClose } from "~/components/sheet/TransactionSheet";
import type { EntryMode } from "~/features/trade/Ticket";
import type { Side } from "~/features/trade/useTicket";
import { useAccount } from "~/lib/account/provider";
import { perplPositionRoute, perplWithdrawRoute, ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE } from "~/theme";
import { PERPL_CHAIN, type PerplMarketMeta } from "./market";
import { PerplOpenOutcome } from "./PerplOutcome";
import { PerplTicketEntry } from "./PerplTicketEntry";
import { PerplTicketFooter, perplCommit } from "./PerplTicketFooter";
import { PerplTicketHeader } from "./PerplTicketHeader";
import { PerplDetails, PerplLiquidationInfo, PerplPracticeInfo } from "./PerplTicketSheets";
import { usePerplFill } from "./usePerplFill";
import { type PerplTicketModel, usePerplTicket } from "./usePerplTicket";

const PRICE_UPDATED = "Price updated. Review and slide again.";

function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setOn);
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setOn);
    return () => sub.remove();
  }, []);
  return on;
}

/**
 * The order ticket in Perpl mode (flow book C4; plan §0.9 Ticket): the same full-height sheet, anatomy and slide as
 * the engine's, with Perpl's venue chip and "Mainnet" as plain words, Perpl's maximum on the ruler and its liquidation
 * estimate; a first order composes approve → open the Perpl account (≥ 10 AUSD) → the IOC in one operation and one
 * slide, a step-up above the session's limits named on the rail; the outcome reads the fill from the receipt's events.
 * In Practice every number still shows and the slide reads "Mainnet only" with its reason one tap away.
 */
export function PerplTicketScreen({
  meta,
  side,
  leverage,
}: {
  meta: PerplMarketMeta;
  side: Side | undefined;
  leverage?: number | undefined;
}) {
  const t = usePerplTicket(meta);
  const address = useAccount().hint?.address;
  const screenReader = useScreenReader();
  const [mode, setMode] = useState<EntryMode>("keypad");
  const [child, setChild] = useState<"details" | "liquidation" | "why" | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const sided = useRef(false);

  // Short / Long (or "Trade this") picks the side — and the leverage when the source knows it — once.
  useEffect(() => {
    if (sided.current || (!side && leverage === undefined)) return;
    sided.current = true;
    if (side && side !== t.side) t.setSide(side);
    if (leverage !== undefined && leverage !== t.leverage) t.setLeverage(leverage);
  }, [side, leverage, t]);

  const { trace, active } = t.runner;
  const inFlight = trace.events.length > 0 || active;
  const commit = perplCommit(t);
  // The order's identity at the slide: any change while sliding resets it.
  const resetKey = [
    PERPL_CHAIN,
    meta.marketId,
    address ?? "",
    t.side,
    t.confirmWith,
    t.amountText,
    t.leverage,
    t.plan?.limitPricePNS ?? "",
    t.plan?.depositCNS ?? "",
    t.plan?.lots ?? "",
  ].join("|");

  const confirm = () => {
    setChild(undefined);
    setNote(undefined);
    const explained = storage.getBoolean(STORAGE_KEYS.riskExplained) ?? false;
    const shortExplained = storage.getBoolean(STORAGE_KEYS.shortRiskExplained) ?? false;
    if (!explained || (t.side === "short" && !shortExplained)) {
      router.push(`${ROUTES.riskExplainer}?side=${t.side}` as Href);
      return;
    }
    void t.submit();
  };

  return (
    <View style={styles.fill}>
      <TransactionSheet
        onClose={() => {
          if (trace.record?.outcome === "completed") trace.reset();
          router.back();
        }}
        closeLabel="Close the order ticket"
        locked={trace.running || active}
        header={
          <PerplTicketHeader
            t={t}
            onSide={(s) => {
              setNote(undefined);
              t.setSide(s);
            }}
            sideLocked={inFlight}
          />
        }
      >
        {inFlight ? (
          <Outcome t={t} />
        ) : (
          <>
            <PerplTicketEntry t={t} mode={mode} onMode={setMode} onLiquidation={() => setChild("liquidation")} />
            <PerplTicketFooter
              t={t}
              note={note}
              resetKey={resetKey}
              onReset={() => setNote(PRICE_UPDATED)}
              onConfirm={confirm}
              onDetails={() => setChild("details")}
              onWhy={() => setChild("why")}
            />
          </>
        )}
      </TransactionSheet>
      <PerplDetails
        open={child === "details"}
        onClose={() => setChild(undefined)}
        t={t}
        canOpen={commit.holdable}
        onOpen={confirm}
        screenReader={screenReader}
      />
      <PerplLiquidationInfo open={child === "liquidation"} onClose={() => setChild(undefined)} t={t} />
      <PerplPracticeInfo open={child === "why"} onClose={() => setChild(undefined)} />
    </View>
  );
}

/**
 * While the operation runs, after a failure and once it finalized. Leaving closes the sheet and keeps the trace (keyed
 * outside React): the journey continues, nothing is cancelled or resent. Done after a settled order resets and
 * closes; "Back to ticket" after a failure returns to review; View position and Move it back close first.
 */
function Outcome({ t }: { t: PerplTicketModel }) {
  const close = useTransactionClose();
  const { trace } = t.runner;
  const { hash } = usePerplFill(trace.record);
  const settled = trace.record?.outcome === "completed";
  const share = () => {
    const side = trace.record?.reviewedIntent.side === "short" ? "short" : "long";
    const lines = [
      `Opened a ${trace.record?.reviewedIntent.leverage ?? ""}× ${side} on ${t.meta.symbol} with Senryo on Perpl (real money).`,
      ...(hash ? [explorerTxUrl(PERPL_CHAIN, hash)] : []),
    ];
    void Share.share({ message: lines.join("\n") });
  };
  return (
    <View style={styles.pad}>
      <PerplOpenOutcome
        runner={t.runner}
        meta={t.meta}
        onShare={share}
        onLeave={() => close()}
        onDone={() => {
          if (settled) close(() => t.runner.reset());
          else t.runner.reset();
        }}
        onViewPosition={() =>
          close(() => {
            t.runner.reset();
            router.push(perplPositionRoute(t.meta.marketId));
          })
        }
        onMoveBack={() =>
          close(() => {
            t.runner.reset();
            router.push(perplWithdrawRoute);
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.md },
});
