/**
 * The chart's footer on the phone (R5.17; the web's `ChartFooter`): the view — line or candles — the candles' interval
 * while they show, and the terminal's music (the same switch as Preferences): on, a chip names the track ("♪ Arcade ›")
 * and steps to the next; turning it on turns sound on, as on the web.
 */
import { CANDLE_INTERVALS, type CandleInterval } from "@senryo/calls";
import { SONG_TITLES, type SongName, TERMINAL_SONGS } from "@senryo/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
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
  const [musicOn, setMusic] = useMMKVBoolean(STORAGE_KEYS.terminalMusic, storage);
  const [sounds, setSounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [stored, setTrack] = useMMKVString(STORAGE_KEYS.musicTrack, storage);
  const track: SongName = TERMINAL_SONGS.find((s) => s === stored) ?? "arcade";
  const music = musicOn === true && sounds !== false;
  const nextTrack = () => setTrack(TERMINAL_SONGS[(TERMINAL_SONGS.indexOf(track) + 1) % TERMINAL_SONGS.length]);
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
      <View style={styles.group}>
        {music ? (
          <Chip on={false} label={`Track: ${SONG_TITLES[track]}. Next track`} onPress={nextTrack}>
            <Text style={[TYPE.chipLabel, { color: color.text2 }]}>♪ {SONG_TITLES[track]} ›</Text>
          </Chip>
        ) : null}
        <Chip
          on={music}
          label={music ? "Music on. Turn it off" : "Turn the music on"}
          onPress={() => {
            setMusic(!music);
            if (!music && sounds === false) setSounds(true);
          }}
        >
          <Volume size={SIZE.iconSm} color={tint(music)} />
        </Chip>
      </View>
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
