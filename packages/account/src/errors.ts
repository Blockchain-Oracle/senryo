/**
 * Every way sign-in, unlock or a signature can fail, classified once so both apps show the same honest copy.
 * Sources: Mera `MeraError.code` (library/src/errors.ts), react-native-passkey's normalised `error` values (README
 * "Error codes"), and WebAuthn DOMException names on web.
 */
import { isMeraError } from "@category-labs/mera";
import type { RejectReason } from "./policy/types.ts";

export type AuthFailure =
  /** The user dismissed the sheet — return silently (never an error toast). */
  | "cancelled"
  | "prf-unavailable"
  | "no-credentials"
  | "no-create-option"
  | "bad-configuration"
  | "not-supported"
  | "insecure-context"
  | "wrong-account"
  | "invalidated"
  | "timed-out"
  | "interrupted"
  | "host-not-allowed"
  | "unknown";

/** Thrown by the session when a signature is outside the scope (the UI routes `stepUp` rejections to a step-up). */
export class OutOfScopeError extends Error {
  readonly reason: RejectReason;
  readonly stepUp: boolean;
  constructor(reason: RejectReason, stepUp: boolean) {
    super(`Outside the trading session: ${reason}`);
    this.name = "OutOfScopeError";
    this.reason = reason;
    this.stepUp = stepUp;
  }
}

/** The session is locked (expired, idle, backgrounded, signed out). The next action unlocks with one Face ID. */
export class SessionLockedError extends Error {
  constructor() {
    super("Trading is locked");
    this.name = "SessionLockedError";
  }
}

/** A ceremony or gate failed in a way the UI must explain (`kind`), or silently ignore (`cancelled`). */
export class AuthError extends Error {
  readonly kind: AuthFailure;
  constructor(kind: AuthFailure, options?: { cause?: unknown }) {
    super(`Authentication failed: ${kind}`, options);
    this.name = "AuthError";
    this.kind = kind;
  }
}

const RN_PASSKEY: Record<string, AuthFailure> = {
  UserCancelled: "cancelled",
  NoCredentials: "no-credentials",
  NoCreateOption: "no-create-option",
  BadConfiguration: "bad-configuration",
  // react-native-passkey replaces the platform's association error with a generic one (Mera demo wallet.ts).
  RequestFailed: "bad-configuration",
  NotSupported: "not-supported",
  TimedOut: "timed-out",
  Interrupted: "interrupted",
};

const DOM: Record<string, AuthFailure> = {
  // WebAuthn deliberately merges "cancelled" and "no matching passkey" into NotAllowedError.
  NotAllowedError: "cancelled",
  AbortError: "cancelled",
  SecurityError: "host-not-allowed",
  NotSupportedError: "not-supported",
  InvalidStateError: "unknown",
};

function fromCause(cause: unknown): AuthFailure {
  if (cause && typeof cause === "object") {
    const rn = (cause as { error?: unknown }).error;
    if (typeof rn === "string" && rn in RN_PASSKEY) return RN_PASSKEY[rn] ?? "unknown";
    const name = (cause as { name?: unknown }).name;
    if (typeof name === "string" && name in DOM) return DOM[name] ?? "unknown";
  }
  return "unknown";
}

/** Maps anything a ceremony can throw onto one `AuthFailure`. */
export function classifyAuthError(error: unknown): AuthFailure {
  if (error instanceof AuthError) return error.kind;
  if (isMeraError(error)) {
    switch (error.code) {
      case "PRF_UNAVAILABLE":
        return "prf-unavailable";
      case "CRYPTO_UNAVAILABLE":
        return "insecure-context";
      case "PASSKEY_OPERATION_FAILED":
        return fromCause(error.cause);
      default:
        return "unknown";
    }
  }
  return fromCause(error);
}

/** Errors a ceremony produced (wrapped as `AuthError`); anything else (e.g. a step-up callback's) propagates as-is. */
export function isCeremonyError(error: unknown): boolean {
  if (error instanceof AuthError) return false;
  return isMeraError(error) || fromCause(error) !== "unknown";
}

/** Cancel is not an error (ux-product-feel B.11): callers return to where they were without a toast. */
export function isSilent(kind: AuthFailure): boolean {
  return kind === "cancelled";
}
