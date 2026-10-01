/**
 * F10 step 6 / D-163: the ticket becomes the execution trace after the hold — checking (simulation) → signed (Face ID /
 * session) → proposed → voted → finalized. Timings are from the hold. Success is finalized only (D-114): the one
 * confirmed-outcome haptic (and the fill sound, if enabled) fires on finalized, never on a submit or a vote. Failures
 * show the decoded reason; nothing is resent (the journal reconciles on the next launch, D-231). A trade that was
 * signed and then lost by the live watch is "not confirmed yet", never "failed": it may still land, so the ticket
 * offers no retry until TxRecovery has settled it (review R06). While it runs, the user may leave: the order continues
 * and can't be cancelled from here, and the copy says so.
 */
import type { TraceEvent, TraceOutcome, TraceStage } from "@senryo/query";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { ExecutionTrace, type TraceStep } from "~/components/trade/ExecutionTrace";
import { fire } from "~/feedback/fire";
import { shortAddress } from "~/lib/format";
import { SPACE, TYPE, useTheme } from "~/theme";

const STEP_DEFS: ReadonlyArray<{ id: string; label: string; stage: TraceStage }> = [
  { id: "risk", label: "Checking", stage: "checking" },
  { id: "signed", label: "Signed", stage: "signed" },
  { id: "proposed", label: "Proposed", stage: "proposed" },
  { id: "voted", label: "Voted", stage: "voted" },
  { id: "final", label: "Finalized", stage: "finalized" },
];
const COMPLETES: Partial<Record<TraceStage, number>> = { signing: 1, signed: 2, proposed: 3, voted: 4, finalized: 5 };
const MS_PER_SECOND = 1000;
const TENTHS = 10;

function seconds(ms: number): string {
  return `${Math.round(ms / (MS_PER_SECOND / TENTHS)) / TENTHS}s`;
}

/** Plain words for a failed send (simulation reverts carry the decoded contract error). */
export function failureWords(error: unknown): string {
  if (!(error instanceof Error)) return "The trade didn't go through";
  const first = error.message.split("\n")[0] ?? "";
  if (/SlippageExceeded/.test(first)) return "The price moved past your limit. Nothing was sent.";
  if (/InsufficientFreeCollateral/.test(first)) return "Not enough Free to trade at the new price. Nothing was sent.";
  if (/MarketNotOpen/.test(first)) return "The market just closed. Nothing was sent.";
  if (/LossExceedsBalance/.test(first)) {
    return "This close would leave a loss your balance can't cover while other positions stay open. Close the profitable one first, or add money. Nothing was sent.";
  }
  if (/MinHoldNotElapsed/.test(first)) return "Profit can be taken a few seconds after opening. Nothing was sent.";
  if (/Cancel|cancel/.test(first)) return "Cancelled — nothing was signed.";
  return first.length > 0 ? first : "The trade didn't go through";
}

const UNKNOWN_COPY =
  "This order was signed, but its result isn’t confirmed yet. Don’t place it again: it settles on its own, and this screen updates when it does.";
const LEAVE_COPY =
  "You can leave this screen. The order is on its way and can’t be cancelled from here; its result shows on your position and when you reopen this ticket.";

export function TradeTrace({
  events,
  running,
  outcome,
  onDone,
  onLeave,
}: {
  events: readonly TraceEvent[];
  running: boolean;
  /** The settled outcome (`useSettledOutcome`): `unknown` until the journal has the signed tx's result. */
  outcome: TraceOutcome | undefined;
  onDone: () => void;
  /** Closes the screen without touching the trace (while running, or while the result is unknown). */
  onLeave: () => void;
}) {
  const { color } = useTheme();
  const start = events[0]?.at ?? Date.now();
  const unknown = outcome === "unknown";
  const failed = unknown
    ? undefined
    : events.find((e) => e.stage === "failed" || e.stage === "reverted" || e.stage === "abandoned");
  // The live watch lost it and the journal later settled it: say what happened, without a trace row for it.
  const recovered = events.at(-1)?.stage === "failed" && outcome !== undefined && outcome !== "not-sent" && !unknown;
  const landed = recovered && outcome === "finalized";
  const reached = events.reduce((n, e) => Math.max(n, COMPLETES[e.stage] ?? 0), 0);
  const hash = events.find((e) => e.hash)?.hash;
  const settled = events.some((e) => e.stage === "finalized");
  const notified = useRef({ settled: false, failed: false });

  useEffect(() => {
    if (settled && !notified.current.settled) {
      notified.current.settled = true;
      fire("filled", { sound: "fill" });
    }
    if (failed && !landed && !notified.current.failed) {
      notified.current.failed = true;
      fire("fail");
    }
  }, [settled, failed, landed]);

  const steps: TraceStep[] = STEP_DEFS.map((d) => {
    const at = events.find((e) => e.stage === d.stage)?.at;
    return { id: d.id, label: d.label, meta: at === undefined ? undefined : seconds(at - start) };
  });

  return (
    <Panel style={styles.panel}>
      <ExecutionTrace steps={steps} current={reached} failed={failed !== undefined && !landed} />
      {hash ? <Text style={[TYPE.meta, { color: color.text3 }]}>Transaction {shortAddress(hash)}</Text> : null}
      {unknown ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.body, { color: color.warn }]}>
          {UNKNOWN_COPY}
        </Text>
      ) : recovered ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[TYPE.body, { color: outcome === "finalized" ? color.up : color.down }]}
        >
          {outcome === "finalized"
            ? "Confirmed: the order went through. Your position shows it."
            : outcome === "reverted"
              ? "Confirmed: the trade reverted onchain (gas was paid). Nothing else changed."
              : "Confirmed: the trade never reached a block. Nothing changed; you can try again."}
        </Text>
      ) : failed ? (
        <Text style={[TYPE.body, { color: color.down }]}>
          {failed.stage === "reverted"
            ? "The trade reverted onchain (gas was paid). Nothing else changed."
            : failed.stage === "abandoned"
              ? "The block carrying the trade was dropped. Nothing changed; you can try again."
              : failureWords(failed.error)}
        </Text>
      ) : null}
      {unknown ? (
        <View style={styles.actions}>
          <Button label="Leave this screen" variant="outline" onPress={onLeave} />
        </View>
      ) : settled || failed ? (
        <View style={styles.actions}>
          <Button
            label={settled || outcome === "finalized" ? "Done" : "Back to ticket"}
            variant={settled ? "primary" : "outline"}
            onPress={onDone}
          />
        </View>
      ) : running ? (
        <View style={styles.actions}>
          <Text style={[TYPE.meta, { color: color.text2 }]}>{LEAVE_COPY}</Text>
          <Button label="Leave this screen" variant="ghost" onPress={onLeave} />
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  actions: { gap: SPACE.sm },
});
