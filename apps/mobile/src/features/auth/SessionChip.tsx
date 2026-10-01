/**
 * The trading-session chip (spec client.md; Codex consult 1 Oct): "Session 24:10" unlocked · "Locks in 0:59" in the
 * last minute · "Locked". Nothing for a guest: each screen carries one account invitation, and "Browsing" was a label
 * for a state the page already shows. Sentence case, a borderless filled chip; the full sentence is its VoiceOver
 * label. Opens the session sheet.
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useChip } from "~/lib/account/use-chip";
import { ROUTES } from "~/lib/constants/routes";
import { BUTTON, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

function shortLabel(label: string, tone: string): string {
  if (tone === "locked") return "Locked";
  const time = label.split(" ").at(-1) ?? "";
  return tone === "warning" ? `Locks in ${time}` : `Session ${time}`;
}

export function SessionChip() {
  const { color } = useTheme();
  const account = useAccount();
  const chip = useChip();
  if (!account.ready || chip.tone === "none") return null;
  const ink = chip.tone === "unlocked" ? color.up : chip.tone === "warning" ? color.warn : color.text2;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(ROUTES.session);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Trading session: ${chip.label}`}
      hitSlop={SPACE.sm}
      style={[styles.chip, { backgroundColor: color.card }]}
    >
      <View
        style={[
          styles.dot,
          chip.tone === "locked" ? { borderWidth: HAIRLINE_PX, borderColor: ink } : { backgroundColor: ink },
        ]}
      />
      <Text style={[TYPE.chipLabel, { color: ink }]}>{shortLabel(chip.label, chip.tone)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: SIZE.chipHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
