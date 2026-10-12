/**
 * The verdict on the stage (P4; Codex: "results occupy the stage"): who won and by what, both final totals (on the
 * seats above), the pot, and why a tie, refund or forfeit went as it did; then Rematch at the same tier and Share.
 */
import type { DuelView } from "@senryo/api-client";
import { outcomeText, seatOf } from "@senryo/calls";
import { signedUsd, usd } from "@senryo/core";
import { Share, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { SPACE, TYPE, useTheme } from "~/theme";

const SHARE_URL = "https://senryo.xyz/app/duel/";

export function DuelResult({
  m,
  me,
  onRematch,
  onDone,
}: {
  m: DuelView;
  me: string | undefined;
  onRematch: () => void;
  onDone: () => void;
}) {
  const { color } = useTheme();
  const o = outcomeText(m, me);
  const seat = seatOf(m, me);
  const won = m.winner !== null && m.winner.toLowerCase() === me?.toLowerCase();
  const mine = m.results && seat !== null ? m.results[seat] : null;
  const pot =
    m.pot === 0n
      ? "No pot"
      : !m.winner
        ? "Pot returned to both"
        : won
          ? `+${usd(m.pot * 2n)} pot`
          : "The pot went to them";
  const share = async () => {
    fire("tick");
    const line = won ? `I won a duel on Senryo${mine !== null ? ` (${signedUsd(mine)})` : ""}.` : "A duel on Senryo.";
    await Share.share({ message: `${line} Three calls each, the better total takes the pot. ${SHARE_URL}` });
  };
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={[TYPE.pageTitle, styles.center, { color: won ? color.up : color.ink }]}>
        {o.title}
      </Text>
      <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
        {o.detail ? `${o.detail} · ${pot}` : pot}
      </Text>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Rematch"
            onPress={() => {
              onDone();
              onRematch();
            }}
          />
        </View>
        <View style={styles.flex}>
          <Button label="Share" variant="secondary" onPress={() => void share()} />
        </View>
      </View>
      <Button label="Back to tiers" variant="ghost" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm, paddingTop: SPACE.sm },
  center: { textAlign: "center" },
  actions: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
});
