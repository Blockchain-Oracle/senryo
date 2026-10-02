import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthFlowSheet } from "~/features/auth/AuthFlowSheet";
import { SwitchConfirm } from "~/features/auth/SwitchConfirm";
import { useAuthFlow } from "~/features/auth/useAuthFlow";
import { WelcomeActions } from "~/features/auth/WelcomeActions";
import { Story } from "~/features/onboarding/Story";
import { pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, setupRoute } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * First launch and sign-in (A1–A3, A5; F01 / F02 / F03 / F08): the six-scene story with the account actions pinned
 * below it and usable from the first frame. No timed intro: nobody waits for a logo. The passkey ceremony and its
 * outcome rise as a sheet over the story, which stays where it was. Welcome completes only on success or "Look around":
 * a new account continues into the setup it owes from the moment its passkey succeeded; a sign-in shows "Signed in as
 * @handle" and lands on Home; the returning account's Face ID opens Home, and cancelling it opens Home locked.
 */
export default function Welcome() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [switching, setSwitching] = useState(false);
  const flow = useAuthFlow({
    switching: account.hint !== undefined,
    onDone: () => {
      storage.set(STORAGE_KEYS.welcomed, true);
      const owed = pendingSetupStep(account.client?.hint?.address);
      if (owed && owed !== "terms") return router.replace(setupRoute(owed) as Href);
      router.replace(ROUTES.home);
    },
  });
  const { phase } = flow;
  // A3: cancelling the returning account's Face ID still opens Home, locked.
  useEffect(() => {
    if (phase.kind !== "closing" || phase.flow !== "unlock") return;
    storage.set(STORAGE_KEYS.welcomed, true);
    router.replace(ROUTES.home);
  }, [phase]);
  return (
    <View style={[styles.root, { backgroundColor: color.ground }]}>
      <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACE.md }]}>
        <View style={styles.top}>
          <Story />
        </View>
        <View style={styles.bottom}>
          <WelcomeActions flow={flow} onSwitch={() => setSwitching(true)} />
        </View>
      </View>
      {switching ? <SwitchConfirm onChoose={flow.signIn} onClose={() => setSwitching(false)} /> : null}
      <AuthFlowSheet flow={flow} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { flex: 1, justifyContent: "space-between", gap: SPACE.lg },
  top: { flex: 1 },
  bottom: { paddingHorizontal: SIZE.gutter },
});
