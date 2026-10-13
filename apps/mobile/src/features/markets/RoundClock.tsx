/**
 * The one round clock above a list of markets (D-348): the 1-minute window every market shares, as a small ring and
 * "1m closes in 0:42" (or "reopens in 0:19" in the lockout), on the server's clock — so no row repeats it.
 */
import { useRoundClock } from "@senryo/calls/react";
import { StyleSheet, Text, View } from "react-native";
import { CountdownRing } from "~/components/kit/CountdownRing";
import { useClockOffset } from "~/lib/use-clock-offset";
import { SPACE, TYPE, useTheme } from "~/theme";

const RING = 18;
const STROKE = 2;

export function RoundClock() {
  const { color } = useTheme();
  const offsetMs = useClockOffset();
  const clock = useRoundClock();
  return (
    <View style={styles.row} accessibilityRole="timer">
      <CountdownRing
        fromSec={clock.fromSec}
        toSec={clock.toSec}
        offsetMs={offsetMs}
        size={RING}
        stroke={STROKE}
        color={color.inkMuted}
        warn={color.ink}
        track={color.hairline}
      />
      <Text style={[TYPE.caption, styles.time, { color: color.inkMuted }]}>
        {clock.label} {clock.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  time: { fontVariant: ["tabular-nums"] },
});
