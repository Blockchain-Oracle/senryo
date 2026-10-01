import { WEB_ORIGIN } from "@senryo/config";
import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { PhraseGrid } from "~/features/auth/PhraseGrid";
import { QuietState } from "~/features/profile/QuietState";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { useAccount } from "~/lib/account/provider";
import { requestStepUp } from "~/lib/account/step-up";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * The storage provider is named from the platform only in text: its logo appears only where the OS identifies the
 * provider (v2-plan §5.12), which this screen can't know.
 */
const SYNC = Platform.OS === "ios" ? "iCloud Keychain" : "Google Password Manager";
/**
 * F07 recovery (D-034): passkey sync first; a backup passkey (web-first — the vault needs WebCrypto and a file, and S6.12
 * adds the server copy); the 24-word export last, behind a step-up, screenshot-blocked. Three sections in the order a
 * person needs them — what already protects the account, the extra step for moving between ecosystems, and the way
 * out — each a heading over one borderless filled group. Every action here is deliberate and rare, so all are quiet.
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
        <QuietState
          line="Recovery options appear once you have an account"
          action={{ label: "Create account", variant: "primary", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Recovery" }} />
      <View style={styles.section}>
        <SectionHeading>Passkey sync</SectionHeading>
        <Panel style={styles.panel}>
          <View style={styles.row}>
            <PasskeyGlyph color={color.ink} />
            <Text style={[TYPE.rowTitle, styles.fill, { color: color.ink }]}>Your passkey is your account</Text>
          </View>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            {SYNC} (or 1Password) syncs it to your other devices. Open Senryo there, tap “I already have an account”,
            and the same address appears. Nothing to write down.
          </Text>
        </Panel>
      </View>
      <View style={styles.section}>
        <SectionHeading>Backup passkey</SectionHeading>
        <Panel style={styles.panel}>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            Moving between Apple and Google, or using a provider that doesn’t sync? Add a second passkey and keep the
            encrypted recovery file it produces. It is set up on senryo.xyz, for this same account.
          </Text>
          <Button
            label="Open senryo.xyz/account"
            variant="outline"
            onPress={() => void Linking.openURL(`${WEB_ORIGIN}/account/`)}
          />
        </Panel>
      </View>
      <View style={styles.section}>
        <SectionHeading detail="Advanced. Only for moving out; Senryo never needs these words.">
          Export to another wallet
        </SectionHeading>
        {phrase ? (
          <PhraseGrid phrase={phrase} onHide={hide} />
        ) : (
          <Panel style={styles.panel}>
            <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
              The 24 words behind your passkey import into any standard wallet at the same address. Anyone who sees them
              can take your funds.
            </Text>
            <Button label="Show recovery phrase" variant="outline" disabled={!client} onPress={() => void reveal()} />
          </Panel>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  fill: { flex: 1 },
});
