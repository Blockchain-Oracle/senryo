/**
 * The trading-session chip (spec client.md; Living Lacquer utility row, Codex S1b.7 consult #6): "Session 24:10"
 * unlocked · "Locks in 0:59" in the last minute · "Locked" · "Browsing" with no account (F03; a state, not a second
 * create button: each screen carries one account invitation). Sentence case, a
 * pill on the quiet raised surface; the full sentence is its VoiceOver label. Opens the session sheet (or welcome).
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useChip } from "~/lib/account/use-chip";
import { ROUTES } from "~/lib/constants/routes";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

function shortLabel(label: string, tone: string): string {
  if (tone === "locked") return "Locked";
  const time = label.split(" ").at(-1) ?? "";
  return tone === "warning" ? `Locks in ${time}` : `Session ${time}`;
}

export function SessionChip() {
  const { color } = useTheme();
  const account = useAccount();
  const chip = useChip();
  if (!account.ready) return null;
  const none = chip.tone === "none";
  const ink = chip.tone === "unlocked" ? color.up : chip.tone === "warning" ? color.warn : color.text2;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(none ? ROUTES.welcome : ROUTES.session);
      }}
      accessibilityRole="button"
      accessibilityLabel={none ? "Browsing without an account. Create one" : `Trading session: ${chip.label}`}
      hitSlop={SPACE.sm}
      style={[styles.chip, { borderColor: color.border, backgroundColor: color.card }]}
    >
      <View
        style={[
          styles.dot,
          chip.tone === "locked" || none ? { borderWidth: HAIRLINE_PX, borderColor: ink } : { backgroundColor: ink },
        ]}
      />
      <Text style={[TYPE.chipLabel, { color: none ? color.ink : ink }]}>
        {none ? "Browsing" : shortLabel(chip.label, chip.tone)}
      </Text>
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
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.pill,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
