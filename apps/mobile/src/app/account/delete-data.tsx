import { classifyAuthError, isSilent } from "@senryo/account";
import type { SocialDelete } from "@senryo/api-client";
import { socialKeys } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { DEVICE_SCOPE, DeletedSummary, KEPT_SCOPE, ScopeList, SERVER_SCOPE } from "~/features/profile/DeleteScope";
import { QuietState } from "~/features/profile/QuietState";
import { fire } from "~/feedback/fire";
import { clearPhone, oweServerDelete } from "~/lib/account/delete-data";
import { useAccount } from "~/lib/account/provider";
import { deleteRemoteData } from "~/lib/account/remote";
import { requestStepUp } from "~/lib/account/step-up";
import { UNLOCK_WORD } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE, TYPE, useTheme } from "~/theme";

type Phase =
  | { kind: "review" }
  | { kind: "deleting" }
  /** The server part couldn't reach Senryo: try again, or clear the phone now and owe the rest. */
  | { kind: "server-failed" }
  | { kind: "done"; outcome: SocialDelete }
  | { kind: "phone-only" };

/**
 * A9 Delete my data: three compact lists (Senryo's servers · This phone · What stays) → **Delete my data** → passkey
 * step-up → "Deleting…" → the result with the server's count per item. The server delete (alerts, push tokens, vaults,
 * inbox watches included — defect 10) runs first, with the session; then the account signs out and the phone is
 * cleared. Offline: Retry, or clear the phone now — the server part is then retried at the next sign-in with this
 * passkey ("Phone cleared · server pending"). Backing out of the passkey deletes nothing.
 */
export default function DeleteDataScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const queries = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: "review" });
  const address = account.hint?.address;

  const finish = async (next: Phase) => {
    await account.signOut();
    clearPhone(address);
    void queries.invalidateQueries({ queryKey: socialKeys.all });
    fire(next.kind === "done" ? "confirm" : "warn");
    setPhase(next);
  };
  const runServer = async () => {
    const client = account.client;
    if (!client) return;
    setPhase({ kind: "deleting" });
    try {
      const outcome = await deleteRemoteData(client, account.settings.faceId);
      await finish({ kind: "done", outcome });
    } catch (error) {
      if (isSilent(classifyAuthError(error))) return setPhase({ kind: "review" });
      fire("fail");
      setPhase({ kind: "server-failed" });
    }
  };
  const start = async () => {
    const confirmed = await requestStepUp(
      { title: "Delete your data", detail: `Confirm with ${UNLOCK_WORD}`, confirmLabel: `Delete with ${UNLOCK_WORD}` },
      () => account.stepUp(async () => true),
    ).catch(() => undefined);
    if (confirmed) await runServer();
  };
  const phoneOnly = async () => {
    if (address) oweServerDelete(address);
    await finish({ kind: "phone-only" });
  };

  if (phase.kind === "done" || phase.kind === "phone-only") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Delete my data", headerBackVisible: false, gestureEnabled: false }} />
        <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
          {phase.kind === "done" ? "Data deleted" : "Phone cleared · server pending"}
        </Text>
        {phase.kind === "done" ? (
          <DeletedSummary outcome={phase.outcome} />
        ) : (
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Finishes when you next sign in with this passkey</Text>
        )}
        <Button label="Done" onPress={() => router.replace(ROUTES.welcome)} />
      </Screen>
    );
  }
  if (!address) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Delete my data" }} />
        <QuietState line="No account on this phone" />
      </Screen>
    );
  }
  const busy = phase.kind === "deleting";
  return (
    <Screen>
      <Stack.Screen options={{ title: "Delete my data", gestureEnabled: !busy }} />
      <ScopeList title="Senryo’s servers" lines={SERVER_SCOPE} />
      <ScopeList title="This phone" lines={DEVICE_SCOPE} />
      <ScopeList title="What stays" lines={KEPT_SCOPE} />
      {phase.kind === "server-failed" ? (
        <View style={styles.actions}>
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
            Couldn’t reach Senryo · nothing deleted yet
          </Text>
          <Button label="Try again" onPress={() => void runServer()} />
          <Button label="Clear this phone now" variant="secondary" onPress={() => void phoneOnly()} />
        </View>
      ) : (
        <Button
          label={busy ? "Deleting…" : "Delete my data"}
          variant="destructive"
          loading={busy}
          onPress={() => void start()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACE.sm },
  center: { textAlign: "center" },
});
