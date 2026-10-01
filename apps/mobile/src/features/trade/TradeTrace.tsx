/**
 * F10 step 6 / D-163: the ticket becomes the execution trace after the hold — checking (simulation) → signed (Face ID /
 * session) → proposed → voted → finalized. Timings are from the hold. Success is finalized only (D-114): the one
 * confirmed-outcome haptic (and the fill sound, if enabled) fires on finalized, never on a submit or a vote. Failures
 * show the decoded reason; nothing is resent (the journal reconciles on the next launch, D-231).
 */
import type { TraceEvent, TraceStage } from "@senryo/query";
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

export function TradeTrace({
  events,
  running,
  onDone,
}: {
  events: readonly TraceEvent[];
  running: boolean;
  onDone: () => void;
}) {
  const { color } = useTheme();
  const start = events[0]?.at ?? Date.now();
  const failed = events.find((e) => e.stage === "failed" || e.stage === "reverted" || e.stage === "abandoned");
  const reached = events.reduce((n, e) => Math.max(n, COMPLETES[e.stage] ?? 0), 0);
  const hash = events.find((e) => e.hash)?.hash;
  const settled = events.some((e) => e.stage === "finalized");
  const notified = useRef({ settled: false, failed: false });

  useEffect(() => {
    if (settled && !notified.current.settled) {
      notified.current.settled = true;
      fire("filled", { sound: "fill" });
    }
    if (failed && !notified.current.failed) {
      notified.current.failed = true;
      fire("fail");
    }
  }, [settled, failed]);

  const steps: TraceStep[] = STEP_DEFS.map((d) => {
    const at = events.find((e) => e.stage === d.stage)?.at;
    return { id: d.id, label: d.label, meta: at === undefined ? undefined : seconds(at - start) };
  });

  return (
    <Panel style={styles.panel}>
      <ExecutionTrace steps={steps} current={reached} failed={failed !== undefined} />
      {hash ? <Text style={[TYPE.meta, { color: color.text3 }]}>Transaction {shortAddress(hash)}</Text> : null}
      {failed ? (
        <Text style={[TYPE.body, { color: color.down }]}>
          {failed.stage === "reverted"
            ? "The trade reverted onchain (gas was paid). Nothing else changed."
            : failed.stage === "abandoned"
              ? "The block carrying the trade was dropped. Nothing changed; you can try again."
              : failureWords(failed.error)}
        </Text>
      ) : null}
      {settled || failed ? (
        <View style={styles.actions}>
          <Button
            label={settled ? "Done" : "Back to ticket"}
            variant={settled ? "primary" : "outline"}
            onPress={onDone}
          />
        </View>
      ) : running ? (
        <Text style={[TYPE.meta, { color: color.text2 }]}>Keep the app open until it’s finalized.</Text>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.md },
  actions: { gap: SPACE.sm },
});
