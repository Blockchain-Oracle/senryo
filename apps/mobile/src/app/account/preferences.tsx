import { Stack } from "expo-router";
import { Switch, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, useTheme } from "~/theme";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

/** F60 Preferences — live now: sounds and haptics toggles (default on, read by `fire()`) and the theme. */
export default function Preferences() {
  const { name, setTheme, color } = useTheme();
  const [sounds, setSounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [haptics, setHaptics] = useMMKVBoolean(STORAGE_KEYS.haptics, storage);
  const switchColors = { trackColor: { true: color.primary, false: color.muted }, thumbColor: color.foreground };
  return (
    <Screen>
      <Stack.Screen options={{ title: "Preferences" }} />
      <View style={{ gap: SPACE.sm }}>
        <SectionLabel>FEEDBACK</SectionLabel>
        <Panel>
          <ListRow
            first
            title="Sounds"
            detail="Fill, deposit, send and unlock sounds. Follows the silent switch."
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
            detail="Taps, fills and warnings."
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
        </Panel>
      </View>
      <View style={{ gap: SPACE.sm }}>
        <SectionLabel>THEME</SectionLabel>
        <Segmented options={THEMES} value={name} onChange={(v) => setTheme(v)} label="Theme" />
      </View>
    </Screen>
  );
}
