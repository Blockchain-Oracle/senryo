/**
 * The chart's footer on the phone (R5.17; the web's `ChartFooter`): the view — line or candles — the candles' interval
 * while they show, and the terminal's music (the same switch as Preferences).
 */
import { CANDLE_INTERVALS, type CandleInterval } from "@senryo/calls";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import { ChartCandlestick, ChartLine, Volume } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const CHIP = 32;

function Chip({
  on,
  label,
  onPress,
  children,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      hitSlop={SPACE.xs}
      onPress={() => {
        fire("tick");
        onPress();
      }}
      style={[styles.chip, on ? { backgroundColor: color.raised2 } : null]}
    >
      {children}
    </Pressable>
  );
}

export function ChartFooter({
  candles,
  interval,
  onCandles,
  onInterval,
}: {
  candles: boolean;
  interval: CandleInterval;
  onCandles: (on: boolean) => void;
  onInterval: (i: CandleInterval) => void;
}) {
  const { color } = useTheme();
  const [music, setMusic] = useMMKVBoolean(STORAGE_KEYS.terminalMusic, storage);
  const tint = (on: boolean) => (on ? color.ink : color.text3);
  return (
    <View style={styles.row}>
      <View style={styles.group}>
        <Chip on={!candles} label="Line" onPress={() => onCandles(false)}>
          <ChartLine size={SIZE.iconSm} color={tint(!candles)} />
        </Chip>
        <Chip on={candles} label="Candles" onPress={() => onCandles(true)}>
          <ChartCandlestick size={SIZE.iconSm} color={tint(candles)} />
        </Chip>
        {candles
          ? CANDLE_INTERVALS.map((i) => (
              <Chip key={i} on={i === interval} label={`${i} candles`} onPress={() => onInterval(i)}>
                <Text style={[TYPE.chipLabel, { color: tint(i === interval) }]}>{i}</Text>
              </Chip>
            ))
          : null}
      </View>
      <Chip
        on={music === true}
        label={music ? "Music on. Turn it off" : "Turn the music on"}
        onPress={() => setMusic(!music)}
      >
        <Volume size={SIZE.iconSm} color={tint(music === true)} />
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZE.gutter,
  },
  group: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  chip: {
    minWidth: CHIP,
    height: CHIP,
    paddingHorizontal: SPACE.sm,
    borderRadius: CHIP / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
