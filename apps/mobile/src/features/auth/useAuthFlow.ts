/**
 * One account ceremony at a time, as a small state machine the welcome, the account sheet and the session sheet drive:
 * idle → running → (signed-in → done | check | failed | closing). Cancel is silent: it asks the sheet to slide away
 * (`closing`) rather than vanish. Failures carry their classified kind so the copy and the offered action agree (R04).
 *
 * Sign-in (A3) opens the passkey's account without adopting it, then checks it before anything on the phone changes:
 * - the account this phone already uses, on a deliberate switch → "Already using @x", nothing changes;
 * - an empty account (no profile, nothing held on either network) → `check`: "This passkey opens a different account"
 *   when the phone knew another one, "…an empty account" otherwise, with Use it / Pick another — Pick another
 *   forgets it and opens the picker again, so the previous account stays exactly as it was;
 * - otherwise → adopted, and a ~1 s "Signed in as @handle" moment before `onDone`.
 */
import { type AuthFailure, classifyAuthError, isSilent, type PendingSignIn } from "@senryo/account";
import { useCallback, useEffect, useRef, useState } from "react";
import { fire } from "~/feedback/fire";
import { lastAccount } from "~/lib/account/identity-cache";
import { useAccount } from "~/lib/account/provider";
import { isEmptyAccount } from "./account-check";
import type { CeremonyKind } from "./CeremonyCard";

/** How long "Signed in as @handle" stays before Home (A3: ~1 s, with the unlock sound). */
export const SIGNED_IN_MS = 1_200;

export type CheckReason = "different" | "empty";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type AuthPhase =
  | { kind: "idle" }
  | { kind: "running"; flow: CeremonyKind }
  | { kind: "failed"; flow: CeremonyKind; failure: AuthFailure }
  /** The opened account looks wrong: Use it / Pick another before anything changes. */
  | { kind: "check"; reason: CheckReason; pending: PendingSignIn }
  /** Adopted: the short confirmation moment, then `onDone("sign-in")`. */
  | { kind: "signed-in"; address: `0x${string}` }
  /** A deliberate switch picked the account already in use. */
  | { kind: "same"; address: `0x${string}` }
  /** The ceremony ended with nothing to show (the user cancelled): the sheet is asked to leave. */
  | { kind: "closing"; flow: CeremonyKind };

export interface AuthFlow {
  phase: AuthPhase;
  /** A provider is asking a second time on first setup (D-029). */
  extraPrompt: boolean;
  create: () => void;
  signIn: () => void;
  unlock: () => void;
  /** Runs the failed flow again. */
  retry: () => void;
  /** `check` → adopt the opened account anyway. */
  useIt: () => void;
  /** `check` → forget it and open the passkey picker again. */
  pickAnother: () => void;
  /** Back to idle (the sheet has slid away, or the failure was dismissed). */
  reset: () => void;
}

export function useAuthFlow({
  onDone,
  switching = false,
}: {
  onDone: (flow: CeremonyKind) => void;
  /** A5: the user asked for another account on purpose — a different account is expected, not warned about. */
  switching?: boolean;
}): AuthFlow {
  const account = useAccount();
  const [phase, setPhase] = useState<AuthPhase>({ kind: "idle" });
  const done = useRef(onDone);
  done.current = onDone;

  const fail = useCallback((flow: CeremonyKind, error: unknown) => {
    const failure = classifyAuthError(error);
    if (isSilent(failure)) {
      setPhase({ kind: "closing", flow });
      return;
    }
    fire("fail");
    setPhase({ kind: "failed", flow, failure });
  }, []);

  const run = useCallback(
    async (flow: CeremonyKind, action: () => Promise<unknown>) => {
      setPhase({ kind: "running", flow });
      try {
        await action();
        fire("confirm", { sound: "unlock" });
        done.current(flow);
      } catch (error) {
        fail(flow, error);
      }
    },
    [fail],
  );

  const adopt = useCallback(
    async (pending: PendingSignIn) => {
      setPhase({ kind: "running", flow: "sign-in" });
      try {
        const address = await pending.adopt();
        fire("confirm", { sound: "unlock" });
        setPhase({ kind: "signed-in", address });
      } catch (error) {
        fail("sign-in", error);
      }
    },
    [fail],
  );

  const current = account.hint?.address;
  const signIn = useCallback(async () => {
    setPhase({ kind: "running", flow: "sign-in" });
    let pending: PendingSignIn;
    try {
      pending = await account.openSignIn();
    } catch (error) {
      fail("sign-in", error);
      return;
    }
    if (switching && current && same(current, pending.address)) {
      pending.discard();
      fire("tick");
      setPhase({ kind: "same", address: pending.address });
      return;
    }
    if (await isEmptyAccount(pending.address)) {
      const known = current ?? lastAccount();
      const different = !switching && known !== undefined && !same(known, pending.address);
      fire("warn");
      setPhase({ kind: "check", reason: different ? "different" : "empty", pending });
      return;
    }
    await adopt(pending);
  }, [account.openSignIn, adopt, current, fail, switching]);

  // The confirmation moment, then on.
  useEffect(() => {
    if (phase.kind !== "signed-in") return;
    const id = setTimeout(() => done.current("sign-in"), SIGNED_IN_MS);
    return () => clearTimeout(id);
  }, [phase.kind]);

  const create = useCallback(() => void run("create", account.create), [run, account.create]);
  const unlock = useCallback(() => void run("unlock", account.unlock), [run, account.unlock]);
  const retry = useCallback(() => {
    if (phase.kind !== "failed") return;
    if (phase.flow === "create") create();
    else if (phase.flow === "unlock") unlock();
    else void signIn();
  }, [phase, create, signIn, unlock]);
  const useIt = useCallback(() => {
    if (phase.kind === "check") void adopt(phase.pending);
  }, [phase, adopt]);
  const pickAnother = useCallback(() => {
    if (phase.kind !== "check") return;
    phase.pending.discard();
    void signIn();
  }, [phase, signIn]);
  const reset = useCallback(() => {
    setPhase((was) => {
      if (was.kind === "check") was.pending.discard();
      return { kind: "idle" };
    });
  }, []);

  return {
    phase,
    extraPrompt: account.extraPrompt !== undefined,
    create,
    signIn: () => void signIn(),
    unlock,
    retry,
    useIt,
    pickAnother,
    reset,
  };
}
