import { router, Stack } from "expo-router";
import { StyleSheet, Switch, View } from "react-native";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, useTheme } from "~/theme";

type Appearance = "system" | "dark" | "light";
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
  const [sounds, setSounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [haptics, setHaptics] = useMMKVBoolean(STORAGE_KEYS.haptics, storage);
  const switchColors = { trackColor: { true: color.primary, false: color.muted }, thumbColor: color.foreground };
  const appearance: Appearance = stored === "dark" || stored === "light" ? stored : "system";
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
          <ListRow title="Choose sounds" onPress={() => router.push(ROUTES.accountSounds)} />
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: SPACE.md } });
