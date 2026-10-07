/**
 * The ceremony and its outcome as a sheet over whatever the user was looking at (Solflare S07 / M02 over the story;
 * Codex consult 1 Oct): it rises with the tap, stays attached while the system passkey sheet is up (no drag, no
 * scrim), turns into the failure — or the sign-in's check, or "Signed in as @handle" — in place, and slides away on
 * cancel. The page under it never changes until the account is really in.
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { AuthFailureCard } from "./AuthFailure";
import { CeremonyCard } from "./CeremonyCard";
import { CheckAccount, SameAccount, SignedIn } from "./SignInOutcome";
import type { AuthFlow } from "./useAuthFlow";

/** The ceremony / outcome content: inside `AuthFlowSheet`, or inside a sheet that is already open. */
export function AuthFlowBody({ flow, onClose }: { flow: AuthFlow; onClose?: () => void }) {
  const { phase } = flow;
  switch (phase.kind) {
    case "running":
      return <CeremonyCard kind={phase.flow} extraPrompt={flow.extraPrompt} />;
    case "failed":
      return (
        <AuthFailureCard
          kind={phase.failure}
          flow={phase.flow}
          onRetry={flow.retry}
          onSignIn={flow.signIn}
          onCreate={flow.create}
          onClose={onClose ?? flow.reset}
        />
      );
    case "check":
      return (
        <CheckAccount
          reason={phase.reason}
          address={phase.pending.address}
          onUse={flow.useIt}
          onPick={flow.pickAnother}
        />
      );
    case "signed-in":
      return <SignedIn address={phase.address} />;
    case "same":
      return <SameAccount address={phase.address} onClose={onClose ?? flow.reset} />;
    default:
      return null;
  }
}

/** Phases the sheet stays open for (anything else is idle or leaving). */
export function showsOutcome(flow: AuthFlow): boolean {
  return ["running", "failed", "check", "signed-in", "same"].includes(flow.phase.kind);
}

function Leave({ when }: { when: boolean }) {
  const close = useSheetClose();
  useEffect(() => {
    if (when) close();
  }, [when, close]);
  return null;
}

function SameClose({ flow }: { flow: AuthFlow }) {
  const close = useSheetClose();
  return <AuthFlowBody flow={flow} onClose={() => close()} />;
}

export function AuthFlowSheet({ flow }: { flow: AuthFlow }) {
  const { phase } = flow;
  if (phase.kind === "idle") return null;
  const dismissible = phase.kind === "failed" || phase.kind === "check" || phase.kind === "same";
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sheet onClose={flow.reset} closeLabel="Close" dismissible={dismissible}>
        <Leave when={phase.kind === "closing"} />
        <SameClose flow={flow} />
      </Sheet>
    </View>
  );
}
