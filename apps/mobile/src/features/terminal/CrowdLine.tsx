/**
 * The crowd on this window (pivot "Window: see crowd split"; Mitoshi's word board): how the stake on it splits between
 * Up and Down, from the indexer's window row (`/v1/markets/windows/:id`, refreshed every 5 s while open). Quiet until
 * someone has called; the split is stake, not heads.
 */
import { useWindowProof } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { SPACE, TYPE, useTheme } from "~/theme";

const PERCENT = 100n;
const UP = 0;
const DOWN = 1;
const BAR_H = 3;
const WHOLE = 100;

export function CrowdLine({ windowId }: { windowId: `0x${string}` }) {
  const { color } = useTheme();
  const proof = useWindowProof(windowId, { live: true });
  if (!("value" in proof)) return null;
  const p = proof.value;
  const up = p.bandStake[UP] ?? 0n;
  const down = p.bandStake[DOWN] ?? 0n;
  const total = up + down;
  if (total === 0n) return null;
  const upPct = Number((up * PERCENT) / total);
  const text = `Crowd · Up ${upPct}% · Down ${WHOLE - upPct}% · ${p.calls} ${p.calls === 1 ? "call" : "calls"}`;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={text}>
      <View style={[styles.bar, { backgroundColor: color.chartDown }]}>
        <View style={[styles.fill, { width: `${upPct}%`, backgroundColor: color.chartUp }]} />
      </View>
      <Text style={[TYPE.caption, styles.text, { color: color.inkMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xxs, alignItems: "center" },
  bar: { height: BAR_H, width: "40%", borderRadius: BAR_H, overflow: "hidden" },
  fill: { height: BAR_H },
  text: { textAlign: "center" },
});
