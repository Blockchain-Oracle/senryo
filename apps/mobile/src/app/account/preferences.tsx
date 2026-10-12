import { router, Stack } from "expo-router";
import { StyleSheet, Switch, View } from "react-native";
import { useMMKVBoolean, useMMKVNumber, useMMKVString } from "react-native-mmkv";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { applyVolumes, effectsVolume, fire, musicVolume } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, useTheme } from "~/theme";

type Appearance = "system" | "dark" | "light";
/** Volumes in five steps (F3): the phone has no slider module, and an OTA can't add one. */
type Level = "0" | "25" | "50" | "75" | "100";
const LEVELS = [
  { value: "0", label: "Off" },
  { value: "25", label: "25%" },
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "100", label: "100%" },
] as const;
const PERCENT = 100;
const STEP = 25;
const levelOf = (v: number): Level => String(Math.round((v * PERCENT) / STEP) * STEP) as Level;
const APPEARANCE = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

/**
 * Appearance and Sounds & haptics (A10, G5): the theme follows the system unless a choice is stored; sounds and
 * haptics are separate switches (read by `fire()`, sounds follow the silent switch), and "Choose sounds" picks each cue
 * by ear. Every choice applies as it is made and stays on this phone.
 */
export default function Preferences() {
  const { setTheme, color } = useTheme();
  const [stored] = useMMKVString(STORAGE_KEYS.theme, storage);
  const [reactions, setReactions] = useMMKVBoolean(STORAGE_KEYS.tradeReactions, storage);
  const [sounds, setSounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [haptics, setHaptics] = useMMKVBoolean(STORAGE_KEYS.haptics, storage);
  const [effects, setEffects] = useMMKVNumber(STORAGE_KEYS.effectsVolume, storage);
  const [music, setMusic] = useMMKVNumber(STORAGE_KEYS.musicVolume, storage);
  const [terminalMusic, setTerminalMusic] = useMMKVBoolean(STORAGE_KEYS.terminalMusic, storage);
  const volume = (set: (v: number) => void) => (l: Level) => {
    set(Number(l) / PERCENT);
    applyVolumes();
    fire("tick", { cue: "toggle" });
  };
  const switchColors = { trackColor: { true: color.primary, false: color.muted }, thumbColor: color.foreground };
  const appearance: Appearance = stored === "dark" || stored === "system" ? stored : "light";
  return (
    <Screen>
      <Stack.Screen options={{ title: "Preferences" }} />
      <View style={styles.section}>
        <SectionHeading>Appearance</SectionHeading>
        <Segmented
          options={APPEARANCE}
          value={appearance}
          onChange={(v) => setTheme(v === "system" ? null : v)}
          label="Appearance"
        />
      </View>
      <View style={styles.section}>
        <SectionHeading>Sounds & haptics</SectionHeading>
        <Panel>
          <ListRow
            title="Sounds"
            trailing={
              <Switch
                {...switchColors}
                value={sounds ?? true}
                onValueChange={(v) => setSounds(v)}
                accessibilityLabel="Sounds"
              />
            }
          />
          <ListRow
            title="Haptics"
            trailing={
              <Switch
                {...switchColors}
                value={haptics ?? true}
                onValueChange={(v) => {
                  setHaptics(v);
                  if (v) fire("tick");
                }}
                accessibilityLabel="Haptics"
              />
            }
          />
          <ListRow
            title="Live position reactions"
            trailing={
              <Switch
                {...switchColors}
                value={reactions ?? false}
                onValueChange={setReactions}
                accessibilityLabel="Live position reactions"
              />
            }
          />
          <ListRow
            title="Music in the terminal"
            trailing={
              <Switch
                {...switchColors}
                value={terminalMusic ?? false}
                onValueChange={setTerminalMusic}
                accessibilityLabel="Music in the terminal"
              />
            }
          />
          <ListRow title="Choose sounds" onPress={() => router.push(ROUTES.accountSounds)} />
        </Panel>
        <SectionHeading>Effects volume</SectionHeading>
        <Segmented
          options={LEVELS}
          value={levelOf(effects ?? effectsVolume())}
          onChange={volume(setEffects)}
          label="Effects volume"
        />
        <SectionHeading>Music volume</SectionHeading>
        <Segmented
          options={LEVELS}
          value={levelOf(music ?? musicVolume())}
          onChange={volume(setMusic)}
          label="Music volume"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: SPACE.md } });
