import { WEB_ORIGIN } from "@senryo/config";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState } from "~/components/kit/states";
import { PhraseGrid } from "~/features/auth/PhraseGrid";
import { useAccount } from "~/lib/account/provider";
import { requestStepUp } from "~/lib/account/step-up";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * The storage provider is named from the platform only in text: its logo appears only where the OS identifies the
 * provider (v2-plan §5.12), which this screen can't know.
 */
const SYNC = Platform.OS === "ios" ? "iCloud Keychain" : "Google Password Manager";
/**
 * F07 recovery (D-034): passkey sync first; a backup passkey (web-first — the vault needs WebCrypto and a file, and S6.12
 * adds the server copy); the 24-word export only under Advanced, behind a step-up, screenshot-blocked. Each section is
 * a quiet label over one borderless filled group.
 */
export default function RecoveryScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const [phrase, setPhrase] = useState<string>();
  const hide = useCallback(() => setPhrase(undefined), []);
  const client = account.client;

  const reveal = async () => {
    if (!client) return;
    const words = await requestStepUp(
      {
        title: "Show your recovery phrase",
        detail: "24 words that control this account in any wallet. Anyone who sees them can take your funds.",
        confirmLabel: "Show with passkey",
      },
      async () => (await import("@senryo/account")).revealRecoveryPhrase(client),
    );
    if (words) setPhrase(words);
  };

  if (!account.hint) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Recovery" }} />
        <EmptyState
          why="No account on this phone"
          detail="Recovery options appear once you create or open an account."
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Recovery" }} />
      <SectionLabel>Passkey sync</SectionLabel>
      <Panel style={styles.panel}>
        <View style={styles.row}>
          <PasskeyGlyph color={color.ink} />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Your passkey is your account.</Text>
        </View>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {SYNC} (or 1Password) syncs it to your other devices — open Senryo there, tap "I already have an account", and
          the same address appears. Nothing to write down.
        </Text>
      </Panel>
      <SectionLabel>Backup passkey</SectionLabel>
      <Panel style={styles.panel}>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          Moving between Apple and Google, or using a provider that doesn't sync? Add a second passkey and keep the
          encrypted recovery file it produces. Set it up on senryo.xyz — same account.
        </Text>
        <Button
          label="Open senryo.xyz/account"
          variant="outline"
          onPress={() => void Linking.openURL(`${WEB_ORIGIN}/account/`)}
        />
      </Panel>
      <SectionLabel>Advanced · export to another wallet</SectionLabel>
      {phrase ? (
        <PhraseGrid phrase={phrase} onHide={hide} />
      ) : (
        <Panel style={styles.panel}>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            The 24 words behind your passkey import into any standard wallet at the same address. Only for moving out —
            Senryo never needs them.
          </Text>
          <Button label="Show recovery phrase" variant="outline" disabled={!client} onPress={() => void reveal()} />
        </Panel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
