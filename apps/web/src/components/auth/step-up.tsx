"use client";

/**
 * Step-up (spec session-policy §5): before any always-step-up action the user sees exactly what they are approving,
 * then one fresh passkey ceremony runs it. `useStepUp().confirm(intent, action)` resolves with the action's result, or
 * `undefined` when the user backs out (cancel is silent). Failures stay in the sheet with their fix.
 */
import { type AuthFailure, authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { PASSKEY_TILE_EDGE, PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { AuthCardHeader } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";

/** The modal loads on first use, keeping it out of the landing bundle. */
const Modal = dynamic(() => import("@/components/ui/modal").then((m) => m.Modal), {
  ssr: false,
});

export interface StepUpIntent {
  /** What is being approved, verb first ("Show your recovery phrase"). */
  title: string;
  detail: string;
  confirmLabel?: string;
}

interface Pending {
  intent: StepUpIntent;
  action: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

interface StepUpApi {
  confirm<T>(intent: StepUpIntent, action: () => Promise<T>): Promise<T | undefined>;
}

const StepUpContext = createContext<StepUpApi | undefined>(undefined);

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure>();
  const settled = useRef(false);

  const confirm = useCallback(<T,>(intent: StepUpIntent, action: () => Promise<T>) => {
    settled.current = false;
    setFailure(undefined);
    return new Promise<T | undefined>((resolve, reject) => {
      setPending({ intent, action, resolve: resolve as (v: unknown) => void, reject });
    });
  }, []);

  const close = (value?: unknown) => {
    if (!settled.current) pending?.resolve(value);
    settled.current = true;
    setPending(undefined);
    setBusy(false);
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setFailure(undefined);
    try {
      close(await pending.action());
    } catch (error) {
      const kind = classifyAuthError(error);
      setBusy(false);
      if (isSilent(kind)) return;
      if (kind === "unknown" && !(error instanceof Error && error.name === "AuthError")) {
        settled.current = true;
        pending.reject(error);
        setPending(undefined);
        return;
      }
      setFailure(kind);
    }
  };

  const api = useMemo<StepUpApi>(() => ({ confirm }), [confirm]);
  const copy = failure ? authFailureCopy(failure, "web") : undefined;
  return (
    <StepUpContext.Provider value={api}>
      {children}
      {pending === undefined ? null : (
        <Modal
          open={pending !== undefined}
          onOpenChange={(open) => {
            if (!open) close(undefined);
          }}
          locked={busy}
          title="Confirm with your passkey"
          footer={
            <>
              <Button className="w-full" disabled={busy} onClick={() => void run()}>
                {busy ? <Loader2 className="animate-spin" /> : <PasskeyGlyph />}
                {busy ? "Waiting for your passkey…" : (pending?.intent.confirmLabel ?? "Confirm with passkey")}
              </Button>
              <Button variant="ghost" className="w-full" disabled={busy} onClick={() => close(undefined)}>
                Cancel
              </Button>
            </>
          }
        >
          {pending ? (
            <div className="pb-2">
              <AuthCardHeader
                glyph={<PasskeyGlyph size={PASSKEY_TILE_EDGE} />}
                tone="gold"
                title={pending.intent.title}
              >
                {pending.intent.detail}
              </AuthCardHeader>
              {copy ? (
                <p role="alert" className="text-center text-caption text-down">
                  <span className="font-medium">{copy.title}.</span> {copy.body}
                </p>
              ) : (
                <p className="text-center font-mono text-micro text-muted-foreground uppercase tracking-[0.12em]">
                  Always asked · never inside a trading session
                </p>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </StepUpContext.Provider>
  );
}

export function useStepUp(): StepUpApi {
  const api = useContext(StepUpContext);
  if (!api) throw new Error("useStepUp outside <StepUpProvider>");
  return api;
}
