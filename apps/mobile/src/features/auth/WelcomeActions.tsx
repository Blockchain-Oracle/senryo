/**
 * Welcome actions (F01 / F02 / F03 / F08, D-029). No hint → **Create account** (one passkey ceremony) is primary and
 * "I have an account" runs the discoverable sign-in; with a hint, continuing as that account is primary.
 * "Browse markets" opens Markets without an account. Cancel is silent; failures name their fix.
 */
import { type AuthFailure, classifyAuthError, isSilent } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { LoadingState } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { ttftStart, ttftTap } from "~/lib/account/measure";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, useTheme } from "~/theme";
import { AuthFailureCard } from "./AuthFailure";
import { CeremonyCard, type CeremonyKind } from "./CeremonyCard";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; flow: CeremonyKind }
  | { kind: "failed"; flow: CeremonyKind; failure: AuthFailure };

export function WelcomeActions() {
  const { color } = useTheme();
  const account = useAccount();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    if (account.ready && !account.hint) ttftStart(Date.now());
  }, [account.ready, account.hint]);

  const run = async (flow: CeremonyKind, action: () => Promise<unknown>) => {
    setPhase({ kind: "running", flow });
    try {
      await action();
      fire("confirm", { sound: "unlock" });
      router.replace(ROUTES.home);
    } catch (error) {
      const failure = classifyAuthError(error);
      if (!isSilent(failure)) fire("fail");
      setPhase(isSilent(failure) ? { kind: "idle" } : { kind: "failed", flow, failure });
    }
  };
  const create = () => {
    ttftTap();
    return run("create", account.create);
  };
  const signIn = () => run("sign-in", account.signIn);
  const unlock = () => run("unlock", account.unlock);
  const lookAround = () => {
    storage.set(STORAGE_KEYS.welcomed, true);
    router.replace(ROUTES.markets);
  };

  if (!account.ready) return <LoadingState shape="line" label="Opening Senryo" />;
  if (phase.kind === "running")
    return <CeremonyCard kind={phase.flow} extraPrompt={account.extraPrompt !== undefined} />;
  if (phase.kind === "failed") {
    const retry = { create, "sign-in": signIn, unlock, recover: signIn }[phase.flow];
    return (
      <AuthFailureCard
        kind={phase.failure}
        flow={phase.flow}
        onRetry={() => void retry()}
        onSignIn={() => void signIn()}
        onCreate={() => void create()}
        onBack={() => setPhase({ kind: "idle" })}
      />
    );
  }
  const hint = account.hint;
  // One primary action, two quiet ones beside each other: the controls never crowd the story above them.
  return (
    <View style={styles.actions}>
      {hint ? (
        <>
          <Button
            label={`Continue · ${shortAddress(hint.address)}`}
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            onPress={() => void unlock()}
          />
          <View style={styles.row}>
            <Button
              label="Open Home, locked"
              variant="ghost"
              size="sm"
              style={styles.flex}
              onPress={() => router.replace(ROUTES.home)}
            />
            <Button
              label="Another account"
              variant="ghost"
              size="sm"
              style={styles.flex}
              onPress={() => void signIn()}
            />
          </View>
        </>
      ) : (
        <>
          <Button
            label="Create account"
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            onPress={() => void create()}
          />
          <View style={styles.row}>
            <Button
              label="I have an account"
              variant="ghost"
              size="sm"
              style={styles.flex}
              onPress={() => void signIn()}
            />
            <Button label="Browse markets" variant="ghost" size="sm" style={styles.flex} onPress={lookAround} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACE.sm },
  row: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
});
