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
import { acknowledgeTerms } from "~/features/legal/acknowledged";
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
 * F14 — a guest's first call (`call`, "Place $5 on BTC Up"): the sheet is that call's signing step. The passkey makes
 * the account, placing it agrees the terms (one line here), and the sheet closes straight back to the terminal, which
 * places the held call once the test dollars land; the setup's other steps wait for later.
 */
function Body() {
  const { color } = useTheme();
  const account = useAccount();
  const close = useSheetClose();
  const params = useLocalSearchParams<{ verb?: string; next?: string; call?: string }>();
  const next = inApp(params.next) ? params.next : undefined;
  const firstCall = params.call;
  const title = firstCall ?? (params.verb ? `Create an account to ${params.verb}` : "Create an account");
  const flow = useAuthFlow({
    onDone: () => {
      storage.set(STORAGE_KEYS.welcomed, true);
      const address = account.client?.hint?.address;
      if (firstCall) {
        if (address) acknowledgeTerms(address);
        close();
        return;
      }
      const owed = pendingSetupStep(address);
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
        {firstCall ? (
          <Text style={[TYPE.body, { color: color.inkMuted, textAlign: "center" }]}>
            Your passkey makes your account and signs this call. No seed phrase, no wallet.
          </Text>
        ) : null}
        <Button
          label={firstCall ? "Make my passkey & place it" : "Create account"}
          leading={<PasskeyGlyph color={color.primaryForeground} />}
          disabled={!account.ready}
          onPress={flow.create}
        />
        <Button
          label={firstCall ? "I have a passkey" : "I have an account"}
          variant="secondary"
          disabled={!account.ready}
          onPress={flow.signIn}
        />
        {firstCall ? (
          <Text style={[TYPE.caption, { color: color.text3, textAlign: "center" }]}>
            Practice uses free test dollars. Placing it agrees to the Terms: a call can lose its whole stake.
          </Text>
        ) : null}
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
