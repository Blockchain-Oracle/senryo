import { router, Stack } from "expo-router";
import { StyleSheet, Switch, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, useTheme } from "~/theme";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

/**
 * F60 Preferences — live now: sounds and haptics toggles (default on, read by `fire()`) and the theme. Two sections,
 * each a heading over its control; every choice applies as it is made and stays on this phone.
 */
export default function Preferences() {
  const { name, setTheme, color } = useTheme();
  const [sounds, setSounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [haptics, setHaptics] = useMMKVBoolean(STORAGE_KEYS.haptics, storage);
  const switchColors = { trackColor: { true: color.primary, false: color.muted }, thumbColor: color.foreground };
  return (
    <Screen>
      <Stack.Screen options={{ title: "Preferences" }} />
      <View style={styles.section}>
        <SectionHeading>Sound and touch</SectionHeading>
        <Panel>
          <ListRow
            title="Sounds"
            detail="Onboarding and completed trades/transfers. Follows the silent switch."
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
      <View style={styles.section}>
        <SectionHeading detail="Applies across the app and stays on this phone.">Theme</SectionHeading>
        <Segmented options={THEMES} value={name} onChange={(v) => setTheme(v)} label="Theme" />
      </View>
      <ListRow title="Replay onboarding" onPress={() => router.push(ROUTES.welcome)} />
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: SPACE.md } });
