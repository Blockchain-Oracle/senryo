/**
 * Session chip in the D2 top strip (spec client.md): `● 24:10` unlocked / `● LOCKS 0:59` / `○ LOCKED`, compact for
 * the phone strip; the full sentence is its VoiceOver label. No account → "SIGN UP" (F03). Opens the session sheet.
 * RN port of the web chip (21st-derived D2 status pill, see apps/mobile/.21st/design.json).
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useChip } from "~/lib/account/use-chip";
import { ROUTES } from "~/lib/constants/routes";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

function shortLabel(label: string, tone: string): string {
  if (tone === "locked") return "LOCKED";
  const time = label.split(" ").at(-1) ?? "";
  return tone === "warning" ? `LOCKS ${time}` : time;
}

export function SessionChip() {
  const { color } = useTheme();
  const account = useAccount();
  const chip = useChip();
  if (!account.ready) return null;
  const none = chip.tone === "none";
  const ink = none || chip.tone === "unlocked" ? color.up : chip.tone === "warning" ? color.warn : color.inkMuted;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(none ? ROUTES.welcome : ROUTES.session);
      }}
      accessibilityRole="button"
      accessibilityLabel={none ? "Create an account" : `Trading session: ${chip.label}`}
      hitSlop={SPACE.xs}
      style={[styles.chip, { borderColor: ink }]}
    >
      <View
        style={[
          styles.dot,
          chip.tone === "locked" ? { borderWidth: HAIRLINE_PX, borderColor: ink } : { backgroundColor: ink },
        ]}
      />
      <Text style={[TYPE.micro, { color: ink }]}>{none ? "SIGN UP" : shortLabel(chip.label, chip.tone)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: SIZE.buttonHeightSm - SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
