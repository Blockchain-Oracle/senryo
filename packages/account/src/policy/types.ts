/**
 * Session-policy vocabulary (docs/plan/specs/session-policy.md). Every signature a live session produces is first
 * decoded into an `Action` from the real calldata / typed data, then judged into a `Verdict`. Amounts are usd6
 * bigints decoded from calldata — never trusted from the caller.
 *
 * After the pivot (D-256/D-266) users sign EIP-712 intents and the relayer sends; the prompt-free market intents
 * (commit, close under a `SessionGrant`, D-267) join this vocabulary with the S2 contracts. Until then a session only
 * signs in-app sign-in messages, and every money movement asks for Face ID.
 */
import type { ChainId } from "@senryo/config";
import type { Address } from "viem";

/** D-037: practice → off; mainnet → above the threshold; the user may pick "every call". */
export type FaceIdMode = "off" | "above-threshold" | "every-trade";

export type Action =
  | { kind: "approve"; token: Address; spender: Address; amountUsd6: bigint; spenderKnown: boolean }
  | { kind: "transfer"; token: Address; to: Address; amountUsd6: bigint }
  | { kind: "native-send"; to: Address; valueWei: bigint }
  | { kind: "delegation" }
  | { kind: "typed-data"; primaryType: string }
  | { kind: "message"; format: "prefixed" | "siwe" }
  | { kind: "unknown"; to: Address | undefined; selector: string };

/** Why a session refused to sign. `stepUp` = a fresh Face ID may sign it; otherwise never in this app. */
export type RejectReason =
  | "wrong-chain"
  | "delegation"
  | "value"
  | "send"
  | "approve"
  | "rate"
  | "context-unavailable"
  | "typed-data"
  | "message"
  | "raw-hash"
  | "out-of-scope";

export type Verdict =
  /** In scope: sign with no prompt. */
  | { kind: "sign"; action: Action; spendUsd6: bigint; rateLimited: boolean }
  /** In scope, but D-037 asks for the Face ID gate first (native biometric read / web passkey assertion). */
  | { kind: "confirm"; action: Action; spendUsd6: bigint; rateLimited: boolean; prompt: string }
  /** Out of session scope. `stepUp: true` → the UI runs a step-up; false → this app never signs it. */
  | { kind: "reject"; action: Action | undefined; reason: RejectReason; stepUp: boolean };

/** Live reads the policy needs (from the query cache; synchronous). Missing reads never widen the scope. */
export interface PolicyContext {
  chainId: ChainId;
  self: Address;
  faceId: FaceIdMode;
}

/** What the session has already done (reset on every new session). */
export interface PolicyUsage {
  spentUsd6: bigint;
  /** Epoch ms of recently signed, rate-counted signatures. */
  signedAt: number[];
}

export const emptyUsage = (): PolicyUsage => ({ spentUsd6: 0n, signedAt: [] });

/** D-037 default per network: practice (testnet) off, mainnet above the threshold. */
export function defaultFaceIdMode(network: "mainnet" | "testnet"): FaceIdMode {
  return network === "mainnet" ? "above-threshold" : "off";
}
