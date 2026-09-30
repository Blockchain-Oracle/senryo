import { classifyAuthError, isSilent } from "@senryo/account";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { measureStore } from "~/lib/account/measure";
import { useAccount } from "~/lib/account/provider";
import { deleteRemotePrefs } from "~/lib/account/remote";
import { ROUTES } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * F09 sign out / delete my data. Sign out ends the session and removes this phone's hint and biometric unlock item (the
 * passkey stays with your provider). Delete also clears settings, the measurement log and the first-run flag. Onchain
 * history is public and permanent. Delete also removes the encrypted prefs Senryo keeps (`DELETE /v1/prefs`,
 * authenticated by the session — one Face ID read if locked; backing out cancels the delete). Offline, the phone is
 * still cleared and a toast says the server copy (ciphertext only this account opens) remains.
 */
export default function DeleteDataScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const [confirming, setConfirming] = useState(false);

  const signOut = async () => {
    await account.signOut();
    router.replace(ROUTES.welcome);
  };
  const deleteAll = async () => {
    const client = account.client;
    if (client && account.hint) {
      try {
        await deleteRemotePrefs(client, account.settings.faceId);
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return;
        notify({
          title: "Your encrypted settings are still on Senryo",
          description: "Senryo couldn't be reached. Sign in and delete again to remove them.",
          tone: "warning",
        });
      }
    }
    await account.signOut();
    for (const key of [STORAGE_KEYS.sessionSettings, STORAGE_KEYS.device, STORAGE_KEYS.welcomed]) storage.remove(key);
    measureStore.clear();
    fire("confirm");
    router.replace(ROUTES.welcome);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Delete my data" }} />
      <Panel style={styles.panel}>
        <Text style={[TYPE.label, { color: color.ink }]}>SIGN OUT</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          Forget this phone. Your passkey signs you back in — same address, everything rebuilt.
        </Text>
        <Button label="Sign out" variant="outline" disabled={!account.hint} onPress={() => void signOut()} />
      </Panel>
      <Panel style={styles.panel}>
        <Text style={[TYPE.label, { color: color.ink }]}>DELETE MY DATA</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          Clears everything Senryo keeps on this phone and your encrypted settings on Senryo. Onchain history is public
          and permanent — it can't be deleted by anyone.
        </Text>
        {confirming ? (
          <>
            <Button label="Delete" variant="destructive" onPress={() => void deleteAll()} />
            <Button label="Keep" variant="ghost" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button label="Delete my data" variant="outline" onPress={() => setConfirming(true)} />
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({ panel: { padding: SPACE.md, gap: SPACE.sm } });
