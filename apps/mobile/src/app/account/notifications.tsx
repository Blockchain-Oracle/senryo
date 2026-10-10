import { classifyAuthError, isSilent } from "@senryo/account";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { QuietState } from "~/features/profile/QuietState";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import {
  askPushPermission,
  DEFAULT_CHANNELS,
  type PushChannel,
  type PushChannels,
  type PushPermission,
  readPushPermission,
  registerPush,
  savedRegistration,
} from "~/lib/notifications/push";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * The switches shown. Price alerts, watched markets, invites and the leaderboard don't exist yet (R2.11): their channels
 * stay in the saved choices and come back here with their stage (R8).
 */
const CHANNELS: ReadonlyArray<{ key: PushChannel; title: string; detail: string }> = [
  { key: "results", title: "Call results", detail: "When a call wins, loses or is refunded, with what was paid." },
  { key: "deposits", title: "Money arrived", detail: "When test dollars or a deposit from another chain arrive." },
];

/**
 * You → Notifications (S1b.15; C07): the OS permission first — off, asked, or refused in Settings, with the one action
 * each needs — then, once allowed, one switch per kind of news. A switch saves at once (`PUT /v1/push/token` with the
 * new choices; one Face ID read if trading is locked); if the save fails it flips back and says so. Practice and
 * Mainnet both notify, and each notification names its mode.
 */
export default function NotificationsScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const address = account.hint?.address;
  const [permission, setPermission] = useState<PushPermission>();
  const [channels, setChannels] = useState<PushChannels>(() => savedRegistration()?.channels ?? DEFAULT_CHANNELS);
  const [note, setNote] = useState<string>();
  const [saving, setSaving] = useState<PushChannel | "all">();

  // Coming back from Settings is the usual way a refused permission changes: read it again on every focus.
  useFocusEffect(
    useCallback(() => {
      void readPushPermission().then(setPermission);
    }, []),
  );

  const send = async (next: PushChannels, which: PushChannel | "all"): Promise<boolean> => {
    if (!account.client || !address) return false;
    setSaving(which);
    setNote(undefined);
    try {
      setChannels(await registerPush(account.client, address, account.settings.faceId, next));
      setNote("Saved");
      return true;
    } catch (error) {
      setNote(
        isSilent(classifyAuthError(error))
          ? "Unchanged"
          : "Couldn’t reach Senryo, so this wasn’t saved. Try again in a moment.",
      );
      return false;
    } finally {
      setSaving(undefined);
    }
  };

  const turnOn = async () => {
    const answer = await askPushPermission();
    setPermission(answer);
    if (answer === "granted") {
      fire("confirm");
      await send(channels, "all");
    }
  };

  const toggle = async (key: PushChannel, on: boolean) => {
    fire("tick");
    const before = channels;
    const next = { ...channels, [key]: on };
    setChannels(next);
    if (!(await send(next, key))) setChannels(before);
  };

  if (!address) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Notifications" }} />
        <QuietState
          line="Notifications are about your account"
          detail="Create one and Senryo tells you when a call settles or money arrives."
          action={{ label: "Create account", variant: "primary", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      </Screen>
    );
  }
  if (permission === "unavailable") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Notifications" }} />
        <QuietState
          line="This build can’t receive notifications"
          detail="Update Senryo to the latest version, then come back here to turn them on."
        />
      </Screen>
    );
  }

  const switchColors = { trackColor: { true: color.primary, false: color.muted }, thumbColor: color.foreground };
  return (
    <Screen>
      <Stack.Screen options={{ title: "Notifications" }} />
      {permission === "undetermined" ? (
        <Panel style={styles.ask}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Notifications are off</Text>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            Turn them on to hear about results, payouts and deposits. iOS asks once.
          </Text>
          <Button label="Turn on notifications" size="sm" onPress={() => void turnOn()} loading={saving === "all"} />
        </Panel>
      ) : null}
      {permission === "denied" ? (
        <Panel style={styles.ask}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Off in Settings</Text>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            iOS is set to block Senryo’s notifications. Allow them in Settings and come back; your choices below are
            kept.
          </Text>
          <Button label="Open Settings" size="sm" variant="outline" onPress={() => void Linking.openSettings()} />
        </Panel>
      ) : null}
      <View style={styles.section}>
        <SectionHeading detail="Practice and Real both notify; each notification says which.">
          What to tell you
        </SectionHeading>
        <Panel>
          {CHANNELS.map((c) => (
            <ListRow
              key={c.key}
              title={c.title}
              detail={c.detail}
              trailing={
                <Switch
                  {...switchColors}
                  value={channels[c.key]}
                  disabled={permission !== "granted" || saving !== undefined}
                  onValueChange={(on) => void toggle(c.key, on)}
                  accessibilityLabel={c.title}
                />
              }
            />
          ))}
        </Panel>
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.text2 }]}>
          {note ?? " "}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ask: { padding: SPACE.lg, gap: SPACE.sm },
  section: { gap: SPACE.md },
});
