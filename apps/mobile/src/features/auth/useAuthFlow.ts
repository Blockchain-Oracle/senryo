/**
 * One account ceremony at a time, as a small state machine both the welcome and the account-required sheet drive:
 * idle → running → (done | failed | closing). Cancel is silent: it asks the sheet to slide away (`closing`) rather
 * than vanish. Failures carry their classified kind so the copy and the offered action agree (review R04).
 */
import { type AuthFailure, classifyAuthError, isSilent } from "@senryo/account";
import { useCallback, useState } from "react";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import type { CeremonyKind } from "./CeremonyCard";

export type AuthPhase =
  | { kind: "idle" }
  | { kind: "running"; flow: CeremonyKind }
  | { kind: "failed"; flow: CeremonyKind; failure: AuthFailure }
  /** The ceremony ended with nothing to show (the user cancelled): the sheet is asked to leave. */
  | { kind: "closing" };

export interface AuthFlow {
  phase: AuthPhase;
  /** A provider is asking a second time on first setup (D-029). */
  extraPrompt: boolean;
  create: () => void;
  signIn: () => void;
  unlock: () => void;
  /** Runs the failed flow again. */
  retry: () => void;
  /** Back to idle (the sheet has slid away, or the failure was dismissed). */
  reset: () => void;
}

export function useAuthFlow({ onDone }: { onDone: (flow: CeremonyKind) => void }): AuthFlow {
  const account = useAccount();
  const [phase, setPhase] = useState<AuthPhase>({ kind: "idle" });

  const run = useCallback(
    async (flow: CeremonyKind, action: () => Promise<unknown>) => {
      setPhase({ kind: "running", flow });
      try {
        await action();
        fire("confirm", { sound: "unlock" });
        onDone(flow);
      } catch (error) {
        const failure = classifyAuthError(error);
        if (isSilent(failure)) {
          setPhase({ kind: "closing" });
          return;
        }
        fire("fail");
        setPhase({ kind: "failed", flow, failure });
      }
    },
    [onDone],
  );

  const create = useCallback(() => void run("create", account.create), [run, account.create]);
  const signIn = useCallback(() => void run("sign-in", account.signIn), [run, account.signIn]);
  const unlock = useCallback(() => void run("unlock", account.unlock), [run, account.unlock]);
  const retry = useCallback(() => {
    if (phase.kind !== "failed") return;
    if (phase.flow === "create") create();
    else if (phase.flow === "unlock") unlock();
    else signIn();
  }, [phase, create, signIn, unlock]);
  const reset = useCallback(() => setPhase({ kind: "idle" }), []);

  return { phase, extraPrompt: account.extraPrompt !== undefined, create, signIn, unlock, retry, reset };
}
