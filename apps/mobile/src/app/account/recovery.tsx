import { vaultListRoute } from "@senryo/api-client";
import { WEB_ORIGIN } from "@senryo/config";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { KeyRound, Lock, ShieldCheck } from "~/components/kit/symbols";
import { PhraseGrid } from "~/features/auth/PhraseGrid";
import { dayLabel } from "~/features/profile/format";
import { QuietState } from "~/features/profile/QuietState";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { SettingsRow } from "~/features/profile/SettingsRow";
import { InfoTip } from "~/features/setup/InfoTip";
import { api } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { useSessionGate } from "~/lib/account/session-gate";
import { requestStepUp } from "~/lib/account/step-up";
import { UNLOCK_WORD } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE, useTheme } from "~/theme";

/** The provider is named from the platform only: the OS doesn't tell an app which one holds the passkey (A6). */
const SYNC = Platform.OS === "ios" ? "iCloud Keychain" : "Google Password Manager";
const VAULTS_STALE_MS = 60_000;
const INFO = {
  sync: "Synced passkeys open this account on your other devices. Open Senryo there and tap “I have an account”.",
  backup:
    "A second passkey — for moving between Apple and Google, or a provider that doesn’t sync — opens the same account. It is added on senryo.xyz.",
  phrase:
    "The 24 words behind your passkey import into any standard wallet at the same address. Anyone who sees them can take your funds. Senryo never needs them.",
} as const;

/**
 * Recovery (A6; D-034): three rows — Passkey sync (the platform's provider), Backup passkey ("Not added" / "Added ·
 * 2 Oct", read from the backup list once the api session exists; Add opens senryo.xyz/account), and Export recovery
 * phrase (Advanced: a passkey step-up, then 24 words with screenshots blocked, hidden after 60 s or on background, never
 * copied). Each explanation sits behind its ⓘ. Opening the page never asks for Face ID.
 */
export default function RecoveryScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const gate = useSessionGate();
  const [phrase, setPhrase] = useState<string>();
  const hide = useCallback(() => setPhrase(undefined), []);
  const client = account.client;
  const address = account.hint?.address;
  const vaults = useQuery({
    queryKey: ["vaults", (address ?? "0x").toLowerCase()],
    queryFn: async () => {
      if (!gate.session) throw new Error("no session");
      return (await gate.session(() => api().call(vaultListRoute, {}))).vaults;
    },
    enabled: gate.status === "ready" && gate.session !== undefined,
    staleTime: VAULTS_STALE_MS,
  });

  const reveal = async () => {
    if (!client) return;
    const words = await requestStepUp(
      {
        title: "Show your recovery phrase",
        detail: `Confirm with ${UNLOCK_WORD}`,
        confirmLabel: `Show with ${UNLOCK_WORD}`,
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
          line="No account on this phone"
          action={{ label: "Create account", variant: "primary", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      </Screen>
    );
  }
  const latest = vaults.data?.at(-1);
  const backup =
    gate.status === "locked"
      ? "Unlock to check"
      : vaults.data === undefined
        ? undefined
        : latest
          ? `Added · ${dayLabel(latest.createdAt) ?? ""}`
          : "Not added";
  return (
    <Screen>
      <Stack.Screen options={{ title: "Recovery" }} />
      <Panel>
        <SettingsRow
          title="Passkey sync"
          icon={ShieldCheck}
          tint={color.up}
          value={SYNC}
          control={<InfoTip title="Passkey sync" body={INFO.sync} />}
        />
        <SettingsRow
          title="Backup passkey"
          icon={KeyRound}
          tint={color.warn}
          {...(backup ? { value: backup } : {})}
          control={<InfoTip title="Backup passkey" body={INFO.backup} />}
          onPress={() => {
            if (gate.status === "locked") gate.open();
            // The web's Settings → Recovery adds it (R2.13), in an in-app browser: the app claims senryo.xyz links, so
            // opening the URL itself would come straight back here.
            else void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/app/?d=settings`);
          }}
        />
      </Panel>
      <View style={styles.section}>
        <View style={styles.heading}>
          <SectionHeading>Advanced</SectionHeading>
          <InfoTip title="Recovery phrase" body={INFO.phrase} />
        </View>
        {phrase ? (
          <PhraseGrid phrase={phrase} onHide={hide} />
        ) : (
          <Panel>
            <SettingsRow
              title="Export recovery phrase"
              icon={Lock}
              tint={color.chartNeutral}
              onPress={() => void reveal()}
            />
          </Panel>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md },
  heading: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
