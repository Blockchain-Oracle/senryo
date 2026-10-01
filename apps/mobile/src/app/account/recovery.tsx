import { WEB_ORIGIN } from "@senryo/config";
import { hasArt, ids } from "@senryo/identity";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel, Rule, SectionLabel } from "~/components/kit/Surface";
import { EmptyState } from "~/components/kit/states";
import { PhraseGrid } from "~/features/auth/PhraseGrid";
import { useAccount } from "~/lib/account/provider";
import { requestStepUp } from "~/lib/account/step-up";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The storage provider is named from the platform only in text: its logo appears only where the OS identifies the
 * provider (v2-plan §5.12), which this screen can't know.
 */
const SYNC = Platform.OS === "ios" ? "iCloud Keychain" : "Google Password Manager";
/**
 * The FIDO passkey icon (single flat colour, ≥ 24 px, hidden from screen readers next to its label, per FIDO's usage
 * guidelines). It's a recorded gap until the icon is downloaded through FIDO's form; until then the line is text only.
 */
const PASSKEY = ids.provider("passkey");

/**
 * F07 recovery (D-034): passkey sync first; a backup passkey (web-first — the vault needs WebCrypto and a file, and S6.12
 * adds the server copy); the 24-word export only under Advanced, behind a step-up, screenshot-blocked.
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
      <SectionLabel>PASSKEY SYNC</SectionLabel>
      <Panel style={styles.panel}>
        <View style={styles.row}>
          {hasArt(PASSKEY) ? <EntityMark id={PASSKEY} size={SIZE.markToken} variant="mono" decorative /> : null}
          <Text style={[TYPE.body, { color: color.ink }]}>Your passkey is your account.</Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {SYNC} (or 1Password) syncs it to your other devices — open Senryo there, tap "I already have an account", and
          the same address appears. Nothing to write down.
        </Text>
      </Panel>
      <SectionLabel>BACKUP PASSKEY</SectionLabel>
      <Panel style={styles.panel}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          Moving between Apple and Google, or using a provider that doesn't sync? Add a second passkey and keep the
          encrypted recovery file it produces. Set it up on senryo.xyz — same account.
        </Text>
        <Button
          label="Open senryo.xyz/account"
          variant="outline"
          onPress={() => void Linking.openURL(`${WEB_ORIGIN}/account/`)}
        />
      </Panel>
      <SectionLabel>ADVANCED · EXPORT TO ANOTHER WALLET</SectionLabel>
      <Panel style={styles.panel}>
        {phrase ? (
          <PhraseGrid phrase={phrase} onHide={hide} />
        ) : (
          <View style={styles.gap}>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              The 24 words behind your passkey import into any standard wallet at the same address. Only for moving out
              — Senryo never needs them.
            </Text>
            <Rule />
            <Button label="Show recovery phrase" variant="outline" disabled={!client} onPress={() => void reveal()} />
          </View>
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.sm },
  gap: { gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
