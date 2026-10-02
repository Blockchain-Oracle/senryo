/**
 * F10 step 6 / D-163: the ticket becomes the execution trace after the hold — checking (simulation) → signed (Face ID /
 * session) → proposed → voted → finalized. Timings are from the hold. Success is finalized only (D-114): the one
 * confirmed-outcome haptic (and the fill sound, if enabled) fires on finalized, never on a submit or a vote. Failures
 * show the decoded reason; nothing is resent (the journal reconciles on the next launch, D-231). A trade that was
 * signed and then lost by the live watch is "not confirmed yet", never "failed": it may still land, so the ticket
 * offers no retry until TxRecovery has settled it (review R06). While it runs, the user may leave: the order continues
 * and can't be cancelled from here, and the copy says so.
 */
import type { OperationRecord, TraceEvent, TraceOutcome, TraceStage } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { ExecutionTrace, type TraceStep } from "~/components/trade/ExecutionTrace";
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
export function failureWords(error: unknown, thing = "trade"): string {
  if (!(error instanceof Error)) return `The ${thing} didn't go through. Nothing was sent.`;
  const first = error.message.split("\n")[0] ?? "";
  if (/SlippageExceeded/.test(first)) return "The price moved past your limit. Nothing was sent.";
  if (/InsufficientFreeCollateral/.test(first)) return "Not enough Free to trade at the new price. Nothing was sent.";
  if (/MarketNotOpen/.test(first)) return "The market just closed. Nothing was sent.";
  if (/LossExceedsBalance/.test(first)) {
    return "This close would leave a loss your balance can't cover while other positions stay open. Close the profitable one first, or add money. Nothing was sent.";
  }
  if (/MinHoldNotElapsed/.test(first)) return "Profit can be taken a few seconds after opening. Nothing was sent.";
  if (/Cancel|cancel/.test(first)) return "Cancelled — nothing was signed.";
  return first.length > 0 ? first : `The ${thing} didn't go through. Nothing was sent.`;
}

/**
 * What a trace calls its operation, so every money screen shares one outcome contract (review S01) with its own
 * nouns: a signed send that the watch lost is "not confirmed yet" exactly like an order, never "nothing moved".
 */
export interface TraceWords {
  /** "order", "send", "withdrawal", "swap". */
  thing: string;
  /** What not to do while it's unknown: "place it again", "send it again". */
  again: string;
  /** Said when a lost watch is later confirmed to have landed. */
  landed: string;
  /** Said after a confirmed revert (gas was paid). */
  reverted: string;
  /** The action once it finalized, and after a failure that changed nothing. */
  done: string;
  back: string;
  /** Said while it runs, about leaving the screen. */
  leave: string;
}

export const ORDER_WORDS: TraceWords = {
  thing: "order",
  again: "place it again",
  landed: "Confirmed: the order went through. Your position shows it.",
  reverted: "The trade reverted onchain (gas was paid). Nothing else changed.",
  done: "Done",
  back: "Back to ticket",
  leave:
    "You can leave this screen. The order is on its way and can’t be cancelled from here; its result shows on your position and when you reopen this ticket.",
};

export function TradeTrace({
  events,
  record,
  running,
  outcome,
  onDone,
  onLeave,
  words = ORDER_WORDS,
}: {
  events: readonly TraceEvent[];
  record?: OperationRecord | undefined;
  running: boolean;
  /** The settled outcome (`useSettledOutcome`): `unknown` until the journal has the signed tx's result. */
  outcome: TraceOutcome | undefined;
  onDone: () => void;
  /** Closes the screen without touching the trace (while running, or while the result is unknown). */
  onLeave: () => void;
  /** The operation's nouns (default: an order). */
  words?: TraceWords;
}) {
  const { color } = useTheme();
  const [details, setDetails] = useState(false);
  const partial =
    record?.steps.some((s) => s.outcome === "completed") &&
    (record.steps.some((s) => s.outcome !== "completed") || record.steps.length < record.plannedActions.length);
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

  const steps: TraceStep[] = STEP_DEFS.map((d) => {
    const at = events.find((e) => e.stage === d.stage)?.at;
    return { id: d.id, label: d.label, meta: at === undefined ? undefined : seconds(at - start) };
  });

  return (
    <Panel style={styles.panel}>
      <Text
        accessibilityLiveRegion="polite"
        style={[TYPE.rowTitle, { color: settled || landed ? color.up : color.ink }]}
      >
        {unknown
          ? "Pending"
          : settled || landed
            ? "Completed"
            : failed
              ? "Action needs attention"
              : reached <= 1
                ? "Preparing"
                : reached === 2
                  ? "Confirming"
                  : "Pending"}
      </Text>
      <Button
        label={details ? "Hide transaction details" : "Transaction details"}
        variant="ghost"
        size="sm"
        onPress={() => setDetails(!details)}
      />
      {details ? (
        <>
          <ExecutionTrace steps={steps} current={reached} failed={failed !== undefined && !landed} />
          {hash ? <Text style={[TYPE.meta, { color: color.text3 }]}>Transaction {shortAddress(hash)}</Text> : null}
        </>
      ) : null}
      {partial ? (
        <Text style={[TYPE.rowDetail, { color: color.warn }]}>
          Some steps completed. Review the unfinished steps below.
        </Text>
      ) : null}
      {unknown ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.body, { color: color.warn }]}>
          This {words.thing} was signed, but its result isn’t confirmed yet. Don’t {words.again}: we’ll check the chain,
          and this screen updates when its chain result is known.
        </Text>
      ) : recovered ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[TYPE.body, { color: outcome === "finalized" ? color.up : color.down }]}
        >
          {outcome === "finalized"
            ? words.landed
            : outcome === "reverted"
              ? `Confirmed: ${words.reverted.charAt(0).toLowerCase()}${words.reverted.slice(1)}`
              : partial
                ? "This step was not included. Earlier completed steps remain."
                : `Confirmed: this transaction was not included; you can review it again.`}
        </Text>
      ) : failed ? (
        <Text style={[TYPE.body, { color: color.down }]}>
          {failed.stage === "reverted"
            ? partial
              ? "This step reverted; earlier completed steps remain."
              : words.reverted
            : failed.stage === "abandoned"
              ? partial
                ? "This step was not included. Earlier completed steps remain."
                : `This transaction was not included. Review it before trying again.`
              : partial
                ? "This step did not complete. Review the earlier completed steps before continuing."
                : failureWords(failed.error, words.thing)}
        </Text>
      ) : null}
      {unknown ? (
        <View style={styles.actions}>
          <Button label="Leave this screen" variant="outline" onPress={onLeave} />
        </View>
      ) : settled || failed ? (
        <View style={styles.actions}>
          <Button
            label={settled || outcome === "finalized" ? words.done : words.back}
            variant={settled ? "primary" : "outline"}
            onPress={onDone}
          />
        </View>
      ) : running ? (
        <View style={styles.actions}>
          <Text style={[TYPE.meta, { color: color.text2 }]}>{words.leave}</Text>
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
