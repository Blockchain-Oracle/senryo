/**
 * One-tap's state where calls are made (pivot craft list "session chip", S5.13; the session-expiry experience): while
 * this phone's capped key is live, "One-tap · 12 min · $76 left"; once it lapses or was never on, "One-tap is off ·
 * Turn on" — the next call then asks for the passkey, and this line says why before it does. Compact beside Call |
 * Ride: "One-tap · 12 min" / "One-tap off" (R5.4). A leaf: its once-a-second countdown never re-renders the terminal.
 * Nothing for a guest.
 */

import { useOneTap } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { Pressable, StyleSheet, Text } from "react-native";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";
import { SIZE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const SECONDS_PER_MINUTE = 60;

export function OneTapLine({ compact = false }: { compact?: boolean }) {
  const { color } = useTheme();
  const account = useAccount();
  const owner = account.hint?.address;
  const oneTap = useOneTap(account);
  if (!owner) return null;
  const s = oneTap.state;
  if (s.on) {
    const minutes = Math.ceil(s.secondsLeft / SECONDS_PER_MINUTE);
    const text = compact
      ? `One-tap · ${minutes} min`
      : `One-tap · ${minutes} min · $${formatUnits(s.left, DOLLAR_DECIMALS, 0)} left`;
    return (
      <Text style={[TYPE.caption, styles.line, { color: color.up }]} accessibilityLabel={text}>
        {text}
      </Text>
    );
  }
  return (
    <Pressable
      disabled={oneTap.busy}
      accessibilityRole="button"
      accessibilityLabel="One-tap is off. Turn on one-tap calls"
      style={styles.press}
      onPress={async () => {
        fire("tick");
        try {
          await oneTap.turnOn();
        } catch (error) {
          notify({ title: "Couldn't turn on one-tap", description: (error as Error).message, tone: "warning" });
        }
      }}
    >
      <Text style={[TYPE.caption, styles.line, { color: color.inkMuted }]}>
        {oneTap.busy ? "Turning on…" : compact ? "One-tap " : "One-tap is off · "}
        {oneTap.busy ? null : <Text style={{ color: color.link }}>{compact ? "off" : "Turn on"}</Text>}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { textAlign: "center" },
  press: { minHeight: SIZE.touch / 2, justifyContent: "center" },
});
