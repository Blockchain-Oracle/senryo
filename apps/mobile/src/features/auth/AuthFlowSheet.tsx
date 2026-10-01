/**
 * The ceremony and its outcome as a sheet over whatever the user was looking at (Solflare S07 / M02 over the story;
 * Codex consult 1 Oct): it rises with the tap, stays attached while the system passkey sheet is up (no drag, no
 * scrim), turns into the failure in place, and slides away on cancel. The page under it never changes.
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { AuthFailureCard } from "./AuthFailure";
import { CeremonyCard } from "./CeremonyCard";
import type { AuthFlow } from "./useAuthFlow";

/** The ceremony / failure content: inside `AuthFlowSheet`, or inside a sheet that is already open. */
export function AuthFlowBody({ flow }: { flow: AuthFlow }) {
  const { phase } = flow;
  if (phase.kind === "running") return <CeremonyCard kind={phase.flow} extraPrompt={flow.extraPrompt} />;
  if (phase.kind === "failed") {
    return (
      <AuthFailureCard
        kind={phase.failure}
        flow={phase.flow}
        onRetry={flow.retry}
        onSignIn={flow.signIn}
        onCreate={flow.create}
      />
    );
  }
  return null;
}

function Leave({ when }: { when: boolean }) {
  const close = useSheetClose();
  useEffect(() => {
    if (when) close();
  }, [when, close]);
  return null;
}

export function AuthFlowSheet({ flow }: { flow: AuthFlow }) {
  const { phase } = flow;
  if (phase.kind === "idle") return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sheet onClose={flow.reset} closeLabel="Close" dismissible={phase.kind === "failed"}>
        <Leave when={phase.kind === "closing"} />
        <AuthFlowBody flow={flow} />
      </Sheet>
    </View>
  );
}
