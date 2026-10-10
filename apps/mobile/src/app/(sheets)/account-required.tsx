import { NATIVE_ART } from "@senryo/identity/native";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { AuthFlowBody, showsOutcome } from "~/features/auth/AuthFlowSheet";
import { useAuthFlow } from "~/features/auth/useAuthFlow";
import { pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { setupRoute } from "~/lib/constants/routes";
import { PENDING_LINK } from "~/lib/incoming-link";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";

const Art = NATIVE_ART["scene-passkey"]?.symbol;
/** The art is a compact accent in this sheet, not a scene. */
const ART_SIZE = 112;

/** An in-app path only (never `//host` or a scheme): `next` can arrive from a deep link. */
const inApp = (path: string | undefined): path is string => path?.startsWith("/") === true && !path.startsWith("//");

/**
 * A1: any action a guest takes lands here — art, "Create an account to {verb}", Create account · I have an account ·
 * Keep browsing — without leaving the screen they were on. The ceremony and its outcome replace the invitation in
 * this same sheet. Afterwards the original action resumes once: a new account first runs the setup it owes (the
 * action waits as a pending link until setup is finished or skipped); a sign-in goes straight back to it.
 */
function Body() {
  const { color } = useTheme();
  const account = useAccount();
  const close = useSheetClose();
  const params = useLocalSearchParams<{ verb?: string; next?: string }>();
  const next = inApp(params.next) ? params.next : undefined;
  const title = params.verb ? `Create an account to ${params.verb}` : "Create an account";
  const flow = useAuthFlow({
    onDone: () => {
      storage.set(STORAGE_KEYS.welcomed, true);
      const owed = pendingSetupStep(account.client?.hint?.address);
      if (owed && owed !== "terms") {
        // DeferredLinkHost opens it once setup is done or skipped.
        if (next) storage.set(PENDING_LINK, next);
        close(() => router.push(setupRoute(owed) as Href));
        return;
      }
      close(() => (next ? router.push(next as Href) : undefined));
    },
  });
  const { phase, reset } = flow;
  useEffect(() => {
    if (phase.kind === "closing") reset();
  }, [phase.kind, reset]);
  if (showsOutcome(flow)) return <AuthFlowBody flow={flow} onClose={() => close()} />;
  return (
    <>
      {Art ? (
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Art width={ART_SIZE} height={ART_SIZE} />
        </View>
      ) : null}
      <SheetHeading title={title} />
      <View style={styles.actions}>
        <Button
          label="Create account"
          leading={<PasskeyGlyph color={color.primaryForeground} />}
          disabled={!account.ready}
          onPress={flow.create}
        />
        <Button label="I have an account" variant="secondary" disabled={!account.ready} onPress={flow.signIn} />
        <Button label="Keep browsing" variant="ghost" size="sm" onPress={() => close()} />
        {account.ready ? null : (
          // Why the two buttons wait (R2.15): the account runtime is still opening.
          <Text style={[TYPE.caption, { color: color.text3, textAlign: "center" }]}>Opening Senryo…</Text>
        )}
      </View>
    </>
  );
}

export default function AccountRequiredSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close create account">
      <Body />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
  actions: { gap: SPACE.sm },
});
