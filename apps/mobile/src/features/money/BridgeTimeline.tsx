/**
 * The cross-chain timeline (B4/B9 status; ported from 21st.dev sean0205/vertical-titled-stepper #29815 — numbered
 * dots on a connecting line, a check when done, a spinner on the live step): Sent on Monad → Bridging → Delivered (or
 * Refunded / Failed with the reason), polled from the provider through `/v1/bridge/status` until it is terminal. The
 * destination transaction opens in its explorer when the provider reports one.
 */
import { type BridgeStatusRef, useBridgeStatus } from "@senryo/query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Check, X } from "~/components/kit/symbols";
import { CONTROL_FONT_SCALE, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOT = 24;
const LINE = 2;

export type StepState = "done" | "live" | "waiting" | "failed";

export function BridgeTimeline({
  tracking,
  sent,
  destination,
}: {
  /** Undefined until the Monad step is signed (a CCTP/Across/LI.FI route tracks by its hash). */
  tracking: BridgeStatusRef | undefined;
  /** The Monad side finalized. */
  sent: boolean;
  /** "Base", "Monad". */
  destination: string;
}) {
  const status = useBridgeStatus(sent ? tracking : undefined);
  const value = status.status === "fresh" || status.status === "stale" ? status.value : undefined;
  const state = value?.state;
  const terminal = state === "delivered" || state === "refunded" || state === "failed";
  const steps: { title: string; detail?: string | undefined; state: StepState }[] = [
    { title: "Sent", state: sent ? "done" : "live" },
    {
      title: "Bridging",
      state: !sent ? "waiting" : terminal ? (state === "delivered" ? "done" : "failed") : "live",
      detail: sent && !terminal && status.status === "failed" ? "Checking the route" : undefined,
    },
    {
      title: state === "refunded" ? "Refunded" : state === "failed" ? "Didn’t arrive" : `Delivered on ${destination}`,
      state: state === "delivered" ? "done" : state === "refunded" || state === "failed" ? "failed" : "waiting",
      detail: value?.detail ?? undefined,
    },
  ];
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Transfer to ${destination}`}>
      {steps.map((s, i) => (
        <TimelineStep key={s.title} index={i} last={i === steps.length - 1} {...s} />
      ))}
    </View>
  );
}

/** One numbered step of a timeline (shared with the B4 deposit-address timeline). */
export function TimelineStep({
  title,
  detail,
  state,
  index,
  last,
}: {
  title: string;
  detail?: string | undefined;
  state: StepState;
  index: number;
  last: boolean;
}) {
  const { color } = useTheme();
  const fill = state === "done" ? color.up : state === "failed" ? color.down : color.raised2;
  return (
    <View style={styles.step} accessible accessibilityLabel={`${title}, ${state}`}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: fill }]}>
          {state === "done" ? (
            <Check size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.upForeground} />
          ) : state === "failed" ? (
            <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.downForeground} />
          ) : state === "live" ? (
            <ActivityIndicator size="small" color={color.text2} />
          ) : (
            <Text style={[TYPE.label, { color: color.text3 }]}>{index + 1}</Text>
          )}
        </View>
        {last ? null : (
          <View style={[styles.line, { backgroundColor: state === "done" ? color.up : color.hairline }]} />
        )}
      </View>
      <View style={styles.text}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.rowStrong, { color: state === "waiting" ? color.text3 : color.ink }]}
        >
          {title}
        </Text>
        {detail ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: SPACE.md },
  rail: { alignItems: "center", width: DOT },
  dot: { width: DOT, height: DOT, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  line: { width: LINE, flex: 1, minHeight: SPACE.xl, marginVertical: HAIRLINE_PX },
  text: { flex: 1, gap: SPACE.xxs, paddingBottom: SPACE.lg, paddingTop: SPACE.xxs },
});
