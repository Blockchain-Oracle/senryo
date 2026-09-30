import { type AuthFailure, classifyAuthError, isSilent } from "@senryo/account";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { AuthFailureCard } from "~/features/auth/AuthFailure";
import { CeremonyCard, type CeremonyKind } from "~/features/auth/CeremonyCard";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { TYPE, useTheme } from "~/theme";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; flow: CeremonyKind }
  | { kind: "failed"; flow: CeremonyKind; failure: AuthFailure };

/** F03 → F01: any action a guest takes lands here — create or sign in without leaving the screen they were on. */
function Body() {
  const { color } = useTheme();
  const account = useAccount();
  const close = useSheetClose();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const run = async (flow: CeremonyKind, action: () => Promise<unknown>) => {
    setPhase({ kind: "running", flow });
    try {
      await action();
      fire("confirm", { sound: "unlock" });
      close();
    } catch (error) {
      const failure = classifyAuthError(error);
      setPhase(isSilent(failure) ? { kind: "idle" } : { kind: "failed", flow, failure });
    }
  };
  if (phase.kind === "running")
    return <CeremonyCard kind={phase.flow} extraPrompt={account.extraPrompt !== undefined} />;
  if (phase.kind === "failed") {
    return (
      <AuthFailureCard
        kind={phase.failure}
        flow={phase.flow}
        onRetry={() => void run(phase.flow, phase.flow === "create" ? account.create : account.signIn)}
        onSignIn={() => void run("sign-in", account.signIn)}
        onCreate={() => void run("create", account.create)}
      />
    );
  }
  return (
    <>
      <Text accessibilityRole="header" style={[TYPE.title, { color: color.ink }]}>
        Create an account to trade
      </Text>
      <Text style={[TYPE.body, { color: color.inkMuted }]}>
        Your account is a passkey — Face ID, no seed phrase. Practice mode gives you test dollars to start.
      </Text>
      <Button label="Create account" disabled={!account.ready} onPress={() => void run("create", account.create)} />
      <Button
        label="I already have an account"
        variant="outline"
        disabled={!account.ready}
        onPress={() => void run("sign-in", account.signIn)}
      />
      <Button label="Keep browsing" variant="ghost" onPress={() => close()} />
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
