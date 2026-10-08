/**
 * Session-policy vocabulary (docs/plan/specs/session-policy.md). Every signature a live session produces is first
 * decoded into an `Action` from the real calldata / typed data, then judged into a `Verdict`. Amounts are usd6
 * bigints decoded from calldata — never trusted from the caller.
 */
import type { BinaryEnvironment, BinaryManifest, ChainId } from "@senryo/config";
import type { Address } from "viem";

/** D-037: practice → off; mainnet → above the threshold; the user may pick "every trade". */
export type FaceIdMode = "off" | "above-threshold" | "every-trade";

export type Action =
  | { kind: "binary-mutation"; fn: string; valueWei: bigint }
  | { kind: "open"; marketId: number; isLong: boolean; notionalUsd6: bigint }
  | { kind: "reduce"; fn: "decrease" | "close" | "cancelTrigger" | "placeTrigger"; marketId?: number }
  | { kind: "deposit"; token: Address; amountUsd6: bigint }
  | { kind: "withdraw"; token: Address; amountUsd6: bigint; to: Address; toSelf: boolean }
  | { kind: "swap"; tokenIn: Address; amountUsd6: bigint }
  | { kind: "approve"; token: Address; spender: Address; amountUsd6: bigint; spenderKnown: boolean }
  | { kind: "lp-deposit"; amountUsd6: bigint; receiverSelf: boolean }
  | { kind: "lp-redeem"; fn: "requestRedeem" | "claimRedeem"; receiverSelf: boolean }
  | { kind: "card-safe"; fn: "repayCardDebt" | "revokeSpendAllowance" }
  | { kind: "card-setting"; fn: "setCardEnvelope" | "setSpendAllowance" }
  | { kind: "faucet"; token: Address }
  | { kind: "transfer"; token: Address; to: Address; amountUsd6: bigint }
  | { kind: "native-send"; to: Address; valueWei: bigint }
  | { kind: "delegation" }
  | { kind: "typed-data"; primaryType: string }
  | { kind: "message"; format: "prefixed" | "siwe" }
  /** Perpl (D1): `execOrder` OpenLong/OpenShort — notional at the order's own limit price, leverage from calldata. */
  | { kind: "perpl-open"; marketId: number; isLong: boolean; notionalUsd6: bigint; leverageHdths: bigint }
  /** Perpl `execOrder` CloseLong/CloseShort — reduce-only by contract (`CloseOrderExceedsPosition` otherwise). */
  | { kind: "perpl-reduce"; marketId: number }
  /** Perpl `createAccount` / `depositCollateral`: the wallet's AUSD into its own Perpl account. */
  | { kind: "perpl-deposit"; fn: "createAccount" | "depositCollateral"; amountUsd6: bigint }
  /** Perpl `withdrawCollateral`: always paid to `msg.sender` (the signer) by the contract. */
  | { kind: "perpl-withdraw"; amountUsd6: bigint }
  | { kind: "unknown"; to: Address | undefined; selector: string };

/** Why a session refused to sign. `stepUp` = a fresh passkey ceremony may sign it; otherwise never in this app. */
export type RejectReason =
  | "binary-mutation"
  | "wrong-chain"
  | "delegation"
  | "value"
  | "destination"
  | "send"
  | "over-trade-cap"
  | "over-leverage"
  | "over-session-total"
  | "over-move-cap"
  | "rate"
  | "unknown-spender"
  | "unknown-token"
  | "card-setting"
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
  /** Explicit environment-bound activation; native supplies __DEV__ && dev workspace gates. */
  binary?: { manifest: BinaryManifest; environment: BinaryEnvironment };
  self: Address;
  faceId: FaceIdMode;
  /** Remaining open-interest room on the market side (usd6), from `MarketRegistry` + `MarketAccounting`. */
  marketRoomUsd6(marketId: number, isLong: boolean): bigint | undefined;
  /** Account equity for initial margin (usd6), from `AccountRiskUpdated` / a finalized read. */
  equityUsd6(): bigint | undefined;
  /** Human label for prompts ("Gold"); falls back to "market #id". */
  marketLabel?(marketId: number): string | undefined;
  /** Label of a Perpl market for prompts ("Bitcoin"); its ids overlap the engine's, so it has its own lookup. */
  perplMarketLabel?(marketId: number): string | undefined;
}

/** What the session has already done (reset on every new session). */
export interface PolicyUsage {
  spentUsd6: bigint;
  /** Epoch ms of recently signed, rate-counted transactions. */
  signedAt: number[];
}

export const emptyUsage = (): PolicyUsage => ({ spentUsd6: 0n, signedAt: [] });

/** D-037 default per network: practice (testnet) off, mainnet above the threshold. */
export function defaultFaceIdMode(network: "mainnet" | "testnet"): FaceIdMode {
  return network === "mainnet" ? "above-threshold" : "off";
}
