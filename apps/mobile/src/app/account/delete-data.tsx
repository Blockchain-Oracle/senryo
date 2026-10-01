import { classifyAuthError, isSilent } from "@senryo/account";
import type { SocialDelete } from "@senryo/api-client";
import { useDeleteSocialData } from "@senryo/query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import {
  DEVICE_SCOPE,
  DeletedSummary,
  KEPT_SCOPE,
  ScopeList,
  SERVER_SCOPE,
  USERNAME_HOLD,
} from "~/features/profile/DeleteScope";
import { fire } from "~/feedback/fire";
import { measureStore } from "~/lib/account/measure";
import { useAccount } from "~/lib/account/provider";
import { deleteRemoteData } from "~/lib/account/remote";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SHEET_SHAPE, SPACE, TYPE, useTheme } from "~/theme";

/** Everything on this phone that is about the account (display choices — theme, sounds, mode — are kept). */
const ACCOUNT_KEYS = [
  STORAGE_KEYS.sessionSettings,
  STORAGE_KEYS.device,
  STORAGE_KEYS.welcomed,
  STORAGE_KEYS.setup,
  STORAGE_KEYS.termsAccepted,
  STORAGE_KEYS.riskExplained,
] as const;
/** Stored once per network (`key:chainId`), so they are found by prefix. */
const ACCOUNT_KEY_PREFIXES = [STORAGE_KEYS.liquidationSeen, STORAGE_KEYS.liquidationDismissed] as const;

function clearPhone() {
  for (const key of ACCOUNT_KEYS) storage.remove(key);
  for (const key of storage.getAllKeys()) {
    if (ACCOUNT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) storage.remove(key);
  }
  measureStore.clear();
}

/**
 * What the delete did on the server: everything (with its own count), the social data but not the synced settings,
 * nothing because it couldn't be reached, or nothing because there was no account to delete for.
 */
type Result = { server: "deleted" | "settings-kept"; outcome: SocialDelete } | { server: "kept" } | { server: "none" };

/**
 * F09 sign out / delete my data (J9: the exact scope, said before and after). Sign out ends the session and removes
 * this phone's hint and biometric unlock item (the passkey stays with your provider). Delete removes, on Senryo's
 * servers, the social data (`useDeleteSocialData` → `DELETE /v1/social`: profile, username, follows, blocks, mutes,
 * posts, likes, reports, feed rows; the username stays held 30 days) and the encrypted prefs (`DELETE /v1/prefs`) —
 * authenticated by the session, one Face ID read if locked, and backing out of that prompt cancels the delete — then
 * signs out and clears what this phone keeps about the account. Offline, the phone is still cleared and the result
 * says the server copy remains. Onchain history is public and permanent; the page says so. The result is shown in
 * place, with the server's counts, before leaving for Welcome.
 */
export default function DeleteDataScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const social = useDeleteSocialData(useSessionRunner());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();

  const signOut = async () => {
    await account.signOut();
    router.replace(ROUTES.welcome);
  };
  const deleteAll = async () => {
    setBusy(true);
    let done: Result = { server: "none" };
    const client = account.client;
    if (client && account.hint) {
      let outcome: SocialDelete | undefined;
      try {
        outcome = await social.mutateAsync();
        // Removes the encrypted prefs; its own social delete finds nothing left.
        await deleteRemoteData(client, account.settings.faceId);
        done = { server: "deleted", outcome };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return setBusy(false);
        done = outcome ? { server: "settings-kept", outcome } : { server: "kept" };
      }
    }
    await account.signOut();
    clearPhone();
    fire(done.server === "deleted" || done.server === "none" ? "confirm" : "warn");
    setBusy(false);
    setResult(done);
  };

  if (result) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Delete my data", headerBackVisible: false, gestureEnabled: false }} />
        <View style={styles.block}>
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            {"outcome" in result ? "Your data was deleted" : "This phone was cleared"}
          </Text>
          <Text style={[TYPE.body, { color: color.text2 }]}>
            {"outcome" in result
              ? "Senryo’s servers removed what is counted below, and this phone was cleared. You are signed out."
              : "What this phone kept about the account is gone, and you are signed out."}
          </Text>
        </View>
        {"outcome" in result ? <DeletedSummary outcome={result.outcome} /> : null}
        {result.server === "kept" || result.server === "settings-kept" ? (
          <View accessibilityRole="alert" style={[styles.wash, { backgroundColor: color.warnWash }]}>
            <Text style={[TYPE.rowDetail, { color: color.ink }]}>
              {result.server === "kept"
                ? "Senryo couldn’t be reached, so your profile, posts and synced settings are still on its servers. Sign in and delete again to remove them."
                : "Your synced security settings couldn’t be removed from Senryo’s servers. Sign in and delete again to remove them."}
            </Text>
          </View>
        ) : null}
        <Button label="Done" onPress={() => router.replace(ROUTES.welcome)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Delete my data" }} />
      <View style={styles.block}>
        <Text style={[TYPE.body, { color: color.text2 }]}>
          Deleting removes what Senryo keeps about you, on its servers and on this phone, then signs you out. It can’t
          be undone.
        </Text>
      </View>
      <ScopeList title="Deleted from Senryo’s servers" lines={SERVER_SCOPE} />
      <Text style={[TYPE.rowDetail, styles.note, { color: color.text3 }]}>{USERNAME_HOLD}</Text>
      <ScopeList title="Deleted from this phone" lines={DEVICE_SCOPE} />
      <ScopeList title="What stays" lines={KEPT_SCOPE} />
      {confirming ? (
        <View style={styles.actions}>
          <Button
            label="Delete everything listed"
            variant="destructive"
            loading={busy}
            onPress={() => void deleteAll()}
          />
          <Button label="Keep my data" variant="ghost" disabled={busy} onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button label="Delete my data" variant="outline" onPress={() => setConfirming(true)} />
      )}
      <Panel style={styles.panel}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Only want to leave this phone?</Text>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          Signing out forgets the account here and deletes nothing. Your passkey signs you back in to the same address.
        </Text>
        <Button
          label="Sign out"
          variant="outline"
          size="sm"
          disabled={!account.hint || busy}
          onPress={() => void signOut()}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.sm },
  /** The hold belongs to the server list above it, so it sits closer to that than the page gap. */
  note: { marginTop: -SPACE.md },
  actions: { gap: SPACE.xs },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  wash: { borderRadius: SHEET_SHAPE.rowRadius, padding: SPACE.md },
});
