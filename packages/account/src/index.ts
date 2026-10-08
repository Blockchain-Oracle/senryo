/**
 * `@senryo/account` — the Mera island (spec client.md). Platform pieces come from the conditional subpaths
 * `@senryo/account/{passkey,secret-store,sync}` and are handed to `AccountClient`. Signs, never sends.
 */

/** viem types re-exported so apps never import viem directly (invariant `viem-import-boundary`). */
export type { Address, Hex, LocalAccount } from "viem";
export { createPasskey, getPasskey, type PromptListener } from "./ceremony.ts";
export { AccountClient, type AccountClientOptions, type PendingSignIn } from "./client.ts";
export * from "./constants.ts";
export { authFailureCopy, biometricWord, type Copy, type Surface, scopeCopy } from "./copy.ts";
export {
  isValidMnemonic,
  mnemonicToSeed,
  type OpenedAccount,
  openAccount,
  openAccountFromMnemonic,
  type Pbkdf2Sha512,
  prfOutputToMnemonic,
} from "./derive.ts";
export {
  AuthError,
  type AuthFailure,
  classifyAuthError,
  isSilent,
  mayHaveLeftPasskey,
  OutOfScopeError,
  SessionLockedError,
} from "./errors.ts";
export { type Flow, formatMeasure, type MeasureEvent, type MeasureSink, ttftMs } from "./measure.ts";
export type {
  AccountHint,
  LockReason,
  PasskeyPlatform,
  PlatformKind,
  SecretStore,
  SessionSync,
  SyncEvent,
} from "./platform/types.ts";
export { decodeCall } from "./policy/decode.ts";
export { evaluateSequence, evaluateTransaction, judgeAction, recordUsage, type TxInput } from "./policy/evaluate.ts";
export { scopeTargets } from "./policy/targets.ts";
export { evaluateMessage, evaluateTypedData } from "./policy/typed-data.ts";
export type { Action, FaceIdMode, PolicyContext, PolicyUsage, RejectReason, Verdict } from "./policy/types.ts";
export { defaultFaceIdMode, emptyUsage } from "./policy/types.ts";
export { mergePrefs, openPrefs, PREFS_VERSION, type Prefs, type SyncedWatchlist, sealPrefs } from "./prefs.ts";
export {
  addRecoveryPasskey,
  recoverWithServerVault,
  recoverWithVault,
  revealRecoveryPhrase,
  VaultNotFoundError,
} from "./recovery.ts";
export { type ChipState, type ChipTone, chipState, clock } from "./session/chip.ts";
export {
  type Clock,
  DEFAULT_SETTINGS,
  isLoosening,
  SessionManager,
  type SessionSettings,
  type SessionSnapshot,
  systemClock,
} from "./session/manager.ts";
export { enqueue, isBusy, type NonceSourceLike, queuedNonces } from "./session/queue.ts";
export { UNLOCK_PROMPT } from "./session/signer.ts";
