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
import { ceremonyLifecycle } from "./ceremony-lifecycle";

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
  const lifecycle = useRef(ceremonyLifecycle()).current;
  const opened = useRef<PendingSignIn | undefined>(undefined);
  const current = account.hint?.address;
  const owner = useRef(current);
  owner.current = current;
  const openedFor = useRef(current);
  useEffect(() => {
    lifecycle.mount();
    return () => {
      lifecycle.unmount();
      opened.current?.discard();
    };
  }, [lifecycle]);
  const valid = lifecycle.current;
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
      const id = lifecycle.begin();
      if (id === undefined) return;
      setPhase({ kind: "running", flow });
      try {
        await action();
        if (!valid(id)) return;
        fire("confirm", { sound: "unlock" });
        done.current(flow);
      } catch (error) {
        if (valid(id)) fail(flow, error);
      } finally {
        lifecycle.finish();
      }
    },
    [fail, lifecycle],
  );

  const adopt = useCallback(
    async (pending: PendingSignIn, activeId?: number) => {
      const id = activeId ?? lifecycle.begin();
      if (id === undefined) return;
      if (owner.current !== openedFor.current) {
        pending.discard();
        opened.current = undefined;
        lifecycle.finish();
        setPhase({ kind: "closing", flow: "sign-in" });
        return;
      }
      opened.current = undefined;
      setPhase({ kind: "running", flow: "sign-in" });
      try {
        const address = await pending.adopt();
        if (!valid(id)) return;
        fire("confirm", { sound: "unlock" });
        setPhase({ kind: "signed-in", address });
      } catch (error) {
        if (valid(id)) fail("sign-in", error);
      } finally {
        lifecycle.finish();
      }
    },
    [fail, lifecycle],
  );

  const signIn = useCallback(async () => {
    const id = lifecycle.begin();
    if (id === undefined) return;
    setPhase({ kind: "running", flow: "sign-in" });
    openedFor.current = current;
    let pending: PendingSignIn | undefined;
    try {
      pending = await account.openSignIn();
      if (!valid(id)) return pending.discard();
      if (owner.current !== current) {
        pending.discard();
        opened.current = undefined;
        setPhase({ kind: "closing", flow: "sign-in" });
        return;
      }
      opened.current = pending;
      if (switching && current && same(current, pending.address)) {
        pending.discard();
        opened.current = undefined;
        fire("tick");
        setPhase({ kind: "same", address: pending.address });
        return;
      }
      const empty = await isEmptyAccount(pending.address);
      if (!valid(id)) return pending.discard();
      if (owner.current !== current) {
        pending.discard();
        opened.current = undefined;
        setPhase({ kind: "closing", flow: "sign-in" });
        return;
      }
      if (empty) {
        const known = current ?? lastAccount();
        const different = !switching && known !== undefined && !same(known, pending.address);
        fire("warn");
        setPhase({ kind: "check", reason: different ? "different" : "empty", pending });
        return;
      }
      await adopt(pending, id);
    } catch (error) {
      pending?.discard();
      opened.current = undefined;
      if (valid(id)) fail("sign-in", error);
    } finally {
      lifecycle.finish();
    }
  }, [account.openSignIn, adopt, current, fail, switching, lifecycle]);

  // The confirmation moment, then on.
  useEffect(() => {
    if (phase.kind !== "signed-in") return;
    const address = phase.address;
    const id = setTimeout(() => {
      if (owner.current && same(owner.current, address)) done.current("sign-in");
      else setPhase({ kind: "idle" });
    }, SIGNED_IN_MS);
    return () => clearTimeout(id);
  }, [phase.kind]);

  const create = useCallback(() => {
    if (phase.kind !== "signed-in") void run("create", account.create);
  }, [run, account.create, phase.kind]);
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
    opened.current = undefined;
    void signIn();
  }, [phase, signIn]);
  const reset = useCallback(() => {
    lifecycle.invalidate();
    opened.current?.discard();
    opened.current = undefined;
    setPhase({ kind: "idle" });
  }, [lifecycle]);

  return {
    phase,
    extraPrompt: account.extraPrompt !== undefined,
    create,
    signIn: () => {
      if (phase.kind !== "signed-in") void signIn();
    },
    unlock,
    retry,
    useIt,
    pickAnother,
    reset,
  };
}
