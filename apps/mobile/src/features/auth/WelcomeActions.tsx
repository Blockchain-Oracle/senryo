/**
 * Welcome actions (F01 / F02 / F03 / F08, D-029). No hint → **Create account** (one passkey ceremony) is primary and
 * "I already have an account" runs the discoverable sign-in; with a hint, continuing as that account is primary.
 * "Look around first" opens Markets without an account. Cancel is silent; failures name their fix.
 */
import { type AuthFailure, classifyAuthError, isSilent } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { LoadingState } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { ttftStart, ttftTap } from "~/lib/account/measure";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
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
      router.replace(ROUTES.portfolio);
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
      />
    );
  }
  const hint = account.hint;
  return (
    <View style={styles.actions}>
      {hint ? (
        <>
          <Button
            label={`Continue · ${shortAddress(hint.address)}`}
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            onPress={() => void unlock()}
          />
          <Button label="Open portfolio · locked" variant="outline" onPress={() => router.replace(ROUTES.portfolio)} />
          <Button label="Use a different account" variant="ghost" onPress={() => void signIn()} />
        </>
      ) : (
        <>
          <Button
            label="Create account"
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            onPress={() => void create()}
          />
          <Button
            label="I already have an account"
            variant="outline"
            leading={<PasskeyGlyph color={color.foreground} />}
            onPress={() => void signIn()}
          />
          <Button label="Look around first" variant="ghost" onPress={lookAround} />
        </>
      )}
      <Text style={[TYPE.micro, styles.note, { color: color.inkMuted }]}>
        A PASSKEY IS YOUR ACCOUNT · NO SEED PHRASE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACE.md },
  note: { textAlign: "center" },
});
