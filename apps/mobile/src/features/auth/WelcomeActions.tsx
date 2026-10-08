/**
 * Welcome's fixed action area (A1–A3; Fomo F01's button stack, §0.9 "Story" / "Returning on the same phone"):
 * - no account on this phone → **Create account** (primary, one passkey), **I have an account** (secondary), and
 *   "Look around" (text, the only action that completes Welcome without an account);
 * - this phone's account → its avatar and @handle large (the address only when there is no handle), **Continue with
 *   Face ID** (primary) and "Use another account" (text; A5 asks first).
 * Welcome is marked complete only by a successful ceremony or by Look around (§0.7 #12) — never on the tap, so a
 * cancelled passkey leaves the phone on Welcome. While a ceremony runs the primary shows its spinner and the rest wait.
 */
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { LoadingState } from "~/components/kit/states";
import { ttftStart, ttftTap } from "~/lib/account/measure";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { accountName, useAccountIdentity } from "./SignInOutcome";
import type { AuthFlow } from "./useAuthFlow";

/** The returning account's avatar (A3: large). */
const RETURNING_AVATAR = 72;
const BIOMETRIC = Platform.OS === "ios" ? "Face ID" : "fingerprint";

export function WelcomeActions({ flow, onSwitch }: { flow: AuthFlow; onSwitch: () => void }) {
  const { color } = useTheme();
  const account = useAccount();

  useEffect(() => {
    if (account.ready && !account.hint) ttftStart(Date.now());
  }, [account.ready, account.hint]);

  if (!account.ready) return <LoadingState shape="line" label="Opening Senryo" />;
  const busy = flow.phase.kind === "running" || flow.phase.kind === "signed-in";
  const hint = account.hint;
  if (hint) return <Returning flow={flow} busy={busy} onSwitch={onSwitch} />;
  return (
    <View style={styles.actions}>
      <Button
        label="Create account"
        leading={<PasskeyGlyph color={color.primaryForeground} />}
        loading={busy && flow.phase.kind === "running" && flow.phase.flow === "create"}
        disabled={busy}
        onPress={() => {
          ttftTap();
          flow.create();
        }}
      />
      <Button
        label="I have an account"
        variant="primary"
        loading={busy && flow.phase.kind === "running" && flow.phase.flow === "sign-in"}
        disabled={busy}
        onPress={flow.signIn}
      />
      <Button
        label="Look around"
        variant="secondary"
        size="sm"
        disabled={busy}
        onPress={() => {
          storage.set(STORAGE_KEYS.welcomed, true);
          router.replace(ROUTES.markets);
        }}
      />
    </View>
  );
}

function Returning({ flow, busy, onSwitch }: { flow: AuthFlow; busy: boolean; onSwitch: () => void }) {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const { handle, avatar } = useAccountIdentity(address);
  return (
    <View style={styles.actions}>
      <View style={styles.who} accessible accessibilityLabel={`Your account, ${accountName(handle, address)}`}>
        <Avatar avatar={avatar} {...(address ? { address } : {})} size={RETURNING_AVATAR} />
        <Text style={[TYPE.sheetTitle, { color: color.account }]} numberOfLines={1}>
          {accountName(handle, address)}
        </Text>
      </View>
      <Button
        label={`Continue with ${BIOMETRIC}`}
        leading={<PasskeyGlyph color={color.primaryForeground} />}
        loading={busy}
        onPress={flow.unlock}
      />
      <Button label="Use another account" variant="secondary" size="sm" disabled={busy} onPress={onSwitch} />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACE.sm },
  who: { alignItems: "center", gap: SPACE.sm, paddingBottom: SPACE.md },
});
