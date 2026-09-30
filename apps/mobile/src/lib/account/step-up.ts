/**
 * Step-up requests (spec session-policy §5). A screen asks `requestStepUp(intent, action)`; the `step-up` sheet route
 * shows what is being approved and runs `action` (which performs the one fresh passkey ceremony) on confirm. The
 * promise resolves with the result, or `undefined` if the user backs out (cancel is silent).
 */
import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { ROUTES } from "~/lib/constants/routes";

export interface StepUpIntent {
  /** Verb first: "Show your recovery phrase". */
  title: string;
  detail: string;
  confirmLabel?: string;
}

export interface StepUpRequest {
  intent: StepUpIntent;
  action: () => Promise<unknown>;
  settle: (value: unknown) => void;
  fail: (error: unknown) => void;
}

let current: StepUpRequest | undefined;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function requestStepUp<T>(intent: StepUpIntent, action: () => Promise<T>): Promise<T | undefined> {
  current?.settle(undefined);
  return new Promise<T | undefined>((resolve, reject) => {
    current = {
      intent,
      action,
      settle: (v) => {
        current = undefined;
        emit();
        resolve(v as T | undefined);
      },
      fail: (e) => {
        current = undefined;
        emit();
        reject(e);
      },
    };
    emit();
    router.push(ROUTES.stepUp);
  });
}

export function useStepUpRequest(): StepUpRequest | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => undefined,
  );
}
