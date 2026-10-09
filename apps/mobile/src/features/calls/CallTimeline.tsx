/**
 * A call's steps, oldest first (21st.dev cubby-ui/timeline #28295, ported): an indicator disc per step joined by a
 * line, the step's words, its time, and the transaction one tap away. Done steps carry a check, a refusal a cross,
 * the step still running a hollow disc, so state never rests on colour alone. Borderless rows (no cards).
 */
import { type ChainId, explorerTxUrl } from "@senryo/config";
import type { Tone } from "@senryo/core";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, X } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOT = 22;
const GLYPH = 12;
const RULE = 2;

export interface Step {
  key: string;
  title: string;
  when: string;
  /** done: happened · failed: refused/lost · running: waiting for the next fact. */
  state: "done" | "failed" | "running";
  tone?: Tone;
  txHash?: string;
}

export function CallTimeline({ steps, chainId }: { steps: readonly Step[]; chainId: ChainId }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const tint = s.tone === "up" ? color.up : s.tone === "down" ? color.down : color.ink;
        const disc =
          s.state === "running"
            ? { borderColor: color.inkMuted, backgroundColor: "transparent" }
            : { borderColor: s.state === "failed" ? color.down : color.ink, backgroundColor: color.raised2 };
        const body = (
          <View style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, disc]}>
                {s.state === "done" ? <Check size={GLYPH} color={color.ink} /> : null}
                {s.state === "failed" ? <X size={GLYPH} color={color.down} /> : null}
              </View>
              {last ? null : <View style={[styles.rule, { backgroundColor: color.muted }]} />}
            </View>
            <View style={styles.text}>
              <Text style={[TYPE.rowTitle, { color: tint }]}>{s.title}</Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                {s.when}
                {s.txHash ? " · View transaction" : ""}
              </Text>
            </View>
          </View>
        );
        return s.txHash ? (
          <Pressable
            key={s.key}
            accessibilityRole="link"
            accessibilityLabel={`${s.title}, ${s.when}. View transaction`}
            onPress={() => {
              fire("tick");
              if (s.txHash) void Linking.openURL(explorerTxUrl(chainId, s.txHash));
            }}
          >
            {body}
          </Pressable>
        ) : (
          <View key={s.key} accessible accessibilityLabel={`${s.title}, ${s.when}`}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACE.md, minHeight: SIZE.touch + SPACE.md },
  rail: { width: DOT, alignItems: "center" },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: RULE,
    alignItems: "center",
    justifyContent: "center",
  },
  rule: { flex: 1, width: RULE, marginVertical: SPACE.xs },
  text: { flex: 1, gap: SPACE.xxs, paddingBottom: SPACE.md },
});
