/**
 * The review and outcome pieces every money flow shares (B0.5, Part A8): compact review rows (a pre-approval disclosure
 * may stay as rows), the "from → to" marks line, and the outcome — the one `TradeTrace` surface, with ≤ 3 facts frozen
 * from the reviewed intent, the settled outcome from the journal (an unknown send offers nothing new), and the next
 * action. Steps and hashes live under the trace's Details.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Panel } from "~/components/kit/Surface";
import { ArrowRight } from "~/components/kit/symbols";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { type TraceWords, TradeTrace } from "~/features/trade/TradeTrace";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { MoneyOperationRunner } from "./useMoneyOperation";

/** One label/value line of a review or a receipt; `mark` sits before the value. */
export function ReviewRow({
  label,
  value,
  mark,
  tone,
}: {
  label: string;
  value: string;
  mark?: ReactNode;
  tone?: "warn" | "down" | undefined;
}) {
  const { color } = useTheme();
  const ink = tone === "warn" ? color.warn : tone === "down" ? color.down : color.ink;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} ${value}`}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
        {label}
      </Text>
      <View style={styles.value}>
        {mark}
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={2}
          style={[TYPE.rowAmount, styles.text, { color: ink }]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/** The rows of a review, as one filled group. */
export function ReviewRows({ children }: { children: ReactNode }) {
  return <Panel style={styles.panel}>{children}</Panel>;
}

/** "asset → destination" as two marks with an arrow (B8 review), each named underneath. */
export function MoveLine({
  from,
  to,
  fromLabel,
  toLabel,
}: {
  from: ReactNode;
  to: ReactNode;
  fromLabel: string;
  toLabel: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.move} accessible accessibilityLabel={`${fromLabel} to ${toLabel}`}>
      <View style={styles.end}>
        {from}
        <Text numberOfLines={1} style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
          {fromLabel}
        </Text>
      </View>
      <ArrowRight size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text3} />
      <View style={styles.end}>
        {to}
        <Text numberOfLines={1} style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
          {toLabel}
        </Text>
      </View>
    </View>
  );
}

/** The outcome of a money operation on the one outcome surface; `facts` are the reviewed intent's ≤ 3 rows. */
export function MoneyOutcome({
  runner,
  words,
  title,
  facts,
  onDone,
  onLeave,
}: {
  runner: MoneyOperationRunner;
  words: TraceWords;
  title?: string | undefined;
  facts?: ReactNode;
  onDone: () => void;
  onLeave: () => void;
}) {
  const outcome = useSettledOutcome(runner.trace.events);
  const step = runner.step;
  const stepTitle =
    runner.trace.running && step && step.count > 1 ? `${step.label} · ${step.index + 1} of ${step.count}` : undefined;
  const headline = title ?? stepTitle;
  return (
    <TradeTrace
      record={runner.trace.record}
      events={runner.trace.events}
      running={runner.trace.running}
      outcome={outcome}
      onDone={onDone}
      onLeave={onLeave}
      words={words}
      {...(headline ? { title: headline } : {})}
    >
      {facts ? <ReviewRows>{facts}</ReviewRows> : null}
    </TradeTrace>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
    paddingVertical: SPACE.xs + SPACE.xxs,
  },
  value: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, flexShrink: 1 },
  text: { textAlign: "right", flexShrink: 1 },
  move: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.lg },
  end: { alignItems: "center", gap: SPACE.xs, maxWidth: SIZE.avatarXl * 2 },
  center: { textAlign: "center" },
});
