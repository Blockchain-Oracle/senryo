/**
 * The session chip (pivot craft list): "One-tap on · 12 min · $76 left" while this phone's capped key is live, else
 * "Turn on one-tap". Turning it on or off is one Face ID; the caps are enforced on chain.
 */

import { useOneTap } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { Pressable, StyleSheet, Text } from "react-native";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const SECONDS_PER_MINUTE = 60;

export function OneTapChip() {
  const { color } = useTheme();
  const oneTap = useOneTap(useAccount());
  const s = oneTap.state;
  const label = s.on
    ? `One-tap on · ${Math.ceil(s.secondsLeft / SECONDS_PER_MINUTE)} min · $${formatUnits(s.left, DOLLAR_DECIMALS, 0)} left`
    : "Turn on one-tap calls";
  const toggle = async () => {
    fire("tick");
    try {
      if (s.on) await oneTap.turnOff();
      else await oneTap.turnOn();
    } catch (error) {
      notify({ title: "Couldn't change one-tap", description: (error as Error).message, tone: "warning" });
    }
  };
  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={oneTap.busy}
      accessibilityRole="button"
      accessibilityLabel={s.on ? `${label}. Turn off` : label}
      style={[styles.chip, { backgroundColor: s.on ? color.upWash : color.raised2 }]}
    >
      <Text style={[TYPE.caption, { color: s.on ? color.up : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    minHeight: SIZE.touch - SPACE.sm,
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    borderRadius: (SIZE.touch - SPACE.sm) / 2,
  },
});
