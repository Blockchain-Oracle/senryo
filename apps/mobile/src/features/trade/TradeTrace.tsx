/**
 * The one outcome surface (D-237 rule 8; flow book rule 5): every money action — order, close, send, withdrawal, swap
 * — ends here. One large status glyph, one headline, the caller's key facts, the next action; the chain's stages,
 * timings and hash fold under Details. Truth rules are unchanged (D-114, D-231, D-236, review R06):
 * success is finalized only; a signed send the live watch lost is "not confirmed yet", never "failed", and offers no
 * new action until the journal settles it; a failure never resends — it hands back to review; partial completion
 * (approval done, deposit failed; open done, protection failed) stays visible. Sounds and haptics for the outcome are
 * owned centrally (FeedbackHost), never here.
 */
import type { OperationRecord, TraceEvent, TraceOutcome, TraceStage } from "@senryo/query";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Ban, ChevronDown, CircleCheck, History, X } from "~/components/kit/symbols";
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
const GLYPH = 64;
const SPRING_IN = 14;

function seconds(ms: number): string {
  return `${Math.round(ms / (MS_PER_SECOND / TENTHS)) / TENTHS}s`;
}

/** Plain words for a failed send (simulation reverts carry the decoded contract error). */
export function failureWords(error: unknown, thing = "trade"): string {
  if (!(error instanceof Error)) return `The ${thing} didn't go through. Nothing was sent.`;
  const first = error.message.split("\n")[0] ?? "";
  if (/SlippageExceeded/.test(first)) return "The price moved past your limit. Nothing was sent.";
  if (/InsufficientFreeCollateral/.test(first)) return "Not enough free at the new price. Nothing was sent.";
  if (/MarketNotOpen/.test(first)) return "The market just closed. Nothing was sent.";
  if (/\bPaused\b/.test(first)) return "Trading is paused. Closing still works. Nothing was sent.";
  if (/SettleOnly/.test(first)) return "Closing only: new positions are off. Nothing was sent.";
  if (/LossExceedsBalance/.test(first)) return "Close the profitable position first, or add money. Nothing was sent.";
  if (/MinHoldNotElapsed/.test(first)) return "Profit can be taken a few seconds after opening. Nothing was sent.";
  if (/Cancel|cancel/.test(first)) return "Cancelled — nothing was signed.";
  // Perpl (D1): the decoded Exchange reverts a simulation can hit.
  if (/ExceedsLastExecutionBlock/.test(first)) return "The order’s time window passed. Nothing was sent.";
  if (/AccountExists|AccountDoesNotExist/.test(first)) return "Your Perpl account changed. Review it again.";
  if (/InsufficentAmountToOpenAccount|InsufficientAmountToOpenAccount/.test(first))
    return "Perpl's account minimum went up. Review it again.";
  if (/CloseOrderExceedsPosition/.test(first)) return "The position changed. Review it again.";
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
  /** Said after a confirmed revert (only the network fee was paid). */
  reverted: string;
  /** The action once it finalized, and after a failure that changed nothing. */
  done: string;
  back: string;
  /** Said while it runs, about leaving the screen. */
  leave: string;
  /** Headline while it runs ("Opening short"); default "Processing". */
  pending?: string;
  /** Headline once finalized ("Short XAU opened"); default "Done". */
  success?: string;
}

export const ORDER_WORDS: TraceWords = {
  thing: "order",
  again: "place it again",
  landed: "Confirmed — your position shows it.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to ticket",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Placing order",
  success: "Order placed",
};

type Phase = "running" | "success" | "failed" | "unknown";

/**
 * What a finalized operation actually did, when the receipt status alone can't say (a Perpl IOC succeeds onchain even
 * when it matches no one): `reading` while the screen decodes the receipt — no success is claimed yet — `nothing`
 * when it changed nothing ("Price moved — nothing opened."), and `unread` when the receipt couldn't be decoded (it may
 * have done something: no success, no "nothing"). Undefined: finalized means done.
 */
export type SettledVerdict = "reading" | "nothing" | "unread";

export function TradeTrace({
  events,
  record,
  running,
  outcome,
  onDone,
  onLeave,
  words = ORDER_WORDS,
  title,
  children,
  details: extra,
  next,
  verdict,
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
  /** Overrides the headline for the current phase (e.g. "Short XAU opened"). */
  title?: string;
  /** The key facts for this operation (≤ 3 rows), shown under the headline. */
  children?: ReactNode;
  /** More rows under Details, above the stages (fee, fill, the transaction link). */
  details?: ReactNode;
  /** The next actions once it succeeded ("View position", "Share"), above Done. */
  next?: ReactNode;
  /** Finalized, but still being read or changed nothing (`SettledVerdict`). */
  verdict?: SettledVerdict | undefined;
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
  const phase: Phase = unknown ? "unknown" : settled || landed ? "success" : failed ? "failed" : "running";

  const steps: TraceStep[] = STEP_DEFS.map((d) => {
    const at = events.find((e) => e.stage === d.stage)?.at;
    return { id: d.id, label: d.label, meta: at === undefined ? undefined : seconds(at - start) };
  });

  const headline =
    title ??
    (phase === "success"
      ? (words.success ?? "Done")
      : phase === "unknown"
        ? "Not confirmed yet"
        : phase === "failed"
          ? partial
            ? "Partly done"
            : "Didn’t go through"
          : (words.pending ?? "Processing"));

  const reason =
    phase === "unknown"
      ? `Signed — checking the chain. Don’t ${words.again}.`
      : recovered
        ? outcome === "finalized"
          ? words.landed
          : outcome === "reverted"
            ? words.reverted
            : partial
              ? "This step wasn’t included. Earlier steps remain."
              : "It wasn’t included. Review it again."
        : phase === "failed" && failed
          ? failed.stage === "reverted"
            ? partial
              ? "This step reverted. Earlier steps remain."
              : words.reverted
            : failed.stage === "abandoned"
              ? partial
                ? "This step wasn’t included. Earlier steps remain."
                : "It wasn’t included. Review it again."
              : partial
                ? "This step didn’t finish. Earlier steps remain."
                : failureWords(failed.error, words.thing)
          : phase === "running"
            ? words.leave
            : undefined;

  const reading = phase === "success" && verdict === "reading";
  const nothing = phase === "success" && verdict === "nothing";
  const unread = phase === "success" && verdict === "unread";
  const tone =
    nothing || unread
      ? color.warn
      : phase === "success"
        ? color.up
        : phase === "failed"
          ? color.down
          : phase === "unknown"
            ? color.warn
            : color.ink;

  return (
    <View style={styles.wrap}>
      <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {phase === "running" || reading ? (
          <ActivityIndicator size="large" color={color.text2} />
        ) : (
          <Animated.View entering={ZoomIn.springify().damping(SPRING_IN)}>
            {nothing ? (
              <Ban size={GLYPH} color={tone} />
            ) : unread ? (
              <History size={GLYPH} color={tone} />
            ) : phase === "success" ? (
              <CircleCheck size={GLYPH} color={tone} />
            ) : phase === "failed" ? (
              <X size={GLYPH} color={tone} strokeWidth={2.5} />
            ) : (
              <History size={GLYPH} color={tone} />
            )}
          </Animated.View>
        )}
      </View>
      <Animated.View entering={FadeIn} style={styles.copy}>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[TYPE.sheetTitle, styles.center, { color: color.ink }]}
        >
          {headline}
        </Text>
        {reason ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[TYPE.rowDetail, styles.center, { color: phase === "running" ? color.text2 : tone }]}
          >
            {reason}
          </Text>
        ) : null}
      </Animated.View>
      {children ? <View style={styles.facts}>{children}</View> : null}
      <Pressable
        onPress={() => setDetails(!details)}
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        accessibilityLabel={details ? "Hide details" : "Details"}
        hitSlop={SPACE.sm}
        style={styles.disclosure}
      >
        <Text style={[TYPE.meta, { color: color.text2 }]}>Details</Text>
        <View style={{ transform: [{ rotate: details ? "180deg" : "0deg" }] }}>
          <ChevronDown size={SPACE.md} color={color.text2} />
        </View>
      </Pressable>
      {details ? (
        <Animated.View entering={FadeIn} style={styles.details}>
          {extra}
          <ExecutionTrace steps={steps} current={reached} failed={failed !== undefined && !landed} />
          {hash ? <Text style={[TYPE.meta, { color: color.text3 }]}>Transaction {shortAddress(hash)}</Text> : null}
        </Animated.View>
      ) : null}
      <View style={styles.actions}>
        {phase === "success" && !reading ? next : null}
        {phase === "unknown" || reading || (phase === "running" && running) ? (
          <Button label="Leave this screen" variant={phase === "unknown" ? "outline" : "ghost"} onPress={onLeave} />
        ) : phase === "running" ? null : (
          <Button
            label={phase === "success" || outcome === "finalized" ? words.done : words.back}
            variant={phase === "success" && !nothing && !unread ? "primary" : "outline"}
            onPress={onDone}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "stretch", gap: SPACE.md, paddingVertical: SPACE.lg },
  glyph: { alignItems: "center", justifyContent: "center", height: GLYPH + SPACE.md },
  copy: { gap: SPACE.xs, paddingHorizontal: SPACE.md },
  center: { textAlign: "center" },
  facts: { gap: SPACE.xs },
  disclosure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  details: { gap: SPACE.sm },
  actions: { gap: SPACE.sm },
});
