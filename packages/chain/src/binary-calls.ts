import { BINARY_POLICY, BINARY_STATE } from "@senryo/config";
import { senryoBinaryV1Abi } from "@senryo/contracts";
import { type Hex, keccak256, stringToHex } from "viem";
import {
  assertBinaryManifest,
  type BinaryQuoted,
  type BinarySnapshot,
  binaryBytes32,
  binaryMaxBuy,
  readBinaryRound,
  verifyBinarySource,
} from "./binary-reads.ts";
import { externalCall } from "./calls.ts";
import type { ReadClient } from "./clients.ts";
import type { TxRequest } from "./send.ts";

const UINT64_LIMIT = 1n << 64n;

/** Caller must additionally pin active account/network/foreground/source-generation through the shared planner. */
export interface BinaryReview {
  operationId: Hex;
  now: bigint;
  /** Exact successful pre-review planner ceiling, never a display estimate. */
  reviewedNetworkFeeWei: bigint;
  pendingMonWei: bigint;
  validateScope: () => Promise<void> | void;
}
function metadata(s: BinarySnapshot, action: string, op?: Hex) {
  return {
    kind: "binary",
    venue: "senryo-binary-v1",
    chainId: String(s.manifest.chainId),
    contract: s.manifest.contract,
    configHash: s.manifest.configHash,
    environmentId: s.manifest.environmentId,
    roundId: s.roundId,
    owner: s.owner,
    action,
    ...(op ? { operationId: op } : {}),
    symbol: "MON",
    decimals: "18",
  };
}
function review(s: BinarySnapshot, r: BinaryReview) {
  assertBinaryManifest(s.manifest, s.environment);
  binaryBytes32(s.roundId);
  binaryBytes32(r.operationId);
  if (
    r.now < s.timestamp ||
    r.now - s.timestamp > BigInt(BINARY_POLICY.quoteSeconds) ||
    r.reviewedNetworkFeeWei < 0n ||
    r.pendingMonWei < 0n
  )
    throw new Error("binary: stale snapshot or invalid review");
}
function bind(
  req: TxRequest,
  s: BinarySnapshot,
  r: BinaryReview,
  read: ReadClient,
  check: (fresh: BinarySnapshot) => void,
): TxRequest {
  review(s, r);
  // Pins all economic calldata and deployment identity in the durable request metadata. No alternate sender.
  const fingerprint = keccak256(
    stringToHex(
      JSON.stringify({
        ...metadata(s, req.action, r.operationId),
        data: req.data,
        value: String(req.value ?? 0n),
        reviewedNetworkFeeWei: String(r.reviewedNetworkFeeWei),
      }),
    ),
  );
  return {
    ...req,
    binaryReceiptContext: {
      manifest: Object.freeze({ ...s.manifest }),
      environment: Object.freeze({ ...s.environment }),
      owner: s.owner,
    },
    reviewedNetworkFeeWei: r.reviewedNetworkFeeWei,
    meta: { ...req.meta, reviewFingerprint: fingerprint },
    validate: async () => {
      await r.validateScope();
      const fresh = await readBinaryRound(read, s.manifest, s.environment, s.roundId, s.owner);
      const used = await read.readContract({
        address: s.manifest.contract,
        abi: senryoBinaryV1Abi,
        functionName: "usedOperation",
        args: [s.owner, r.operationId],
        blockNumber: fresh.blockNumber,
      });
      if (used) throw new Error("binary: operation already consumed; reconcile original receipt");
      if (
        fresh.walletMonWei <
        BINARY_POLICY.walletReserveWei + r.pendingMonWei + r.reviewedNetworkFeeWei + (req.value ?? 0n)
      )
        throw new Error("binary: MON reserve/gas unavailable");
      check(fresh);
      await r.validateScope();
    },
  };
}
export function buildBinaryTrade(
  read: ReadClient,
  s: BinaryQuoted,
  r: BinaryReview,
  minOut: bigint,
  deadline: bigint,
): TxRequest {
  review(s, r);
  if (
    minOut <= 0n ||
    minOut > s.quote.output ||
    deadline <= r.now ||
    deadline > r.now + BigInt(BINARY_POLICY.quoteSeconds) ||
    deadline >= s.round.cutoff ||
    deadline >= UINT64_LIMIT ||
    s.quote.input <= 0n ||
    s.quote.timestamp !== s.timestamp ||
    s.quote.blockNumber !== s.blockNumber ||
    s.quote.state !== BINARY_STATE.Open ||
    s.quote.revision !== s.round.revision
  )
    throw new Error("binary: invalid quote, minimum or deadline");
  const amount = s.quote.input;
  if (
    s.action === "buy" &&
    (amount < BINARY_POLICY.buyMinWei ||
      amount >
        binaryMaxBuy(
          s.walletMonWei,
          r.pendingMonWei,
          r.reviewedNetworkFeeWei,
          BINARY_POLICY.supplyCapWei - s.round.escrow,
        ))
  )
    throw new Error("binary: buy budget");
  if (s.action === "sell" && amount > (s.isUp ? s.position.up : s.position.down))
    throw new Error("binary: shares unavailable");
  const meta = {
    ...metadata(s, s.action, r.operationId),
    side: s.isUp ? "up" : "down",
    amount: String(amount),
    minOut: String(minOut),
    quotedOut: String(s.quote.output),
    deadline: String(deadline),
    quoteRevision: String(s.quote.revision),
    quoteBlock: String(s.blockNumber),
  };
  const req =
    s.action === "buy"
      ? externalCall(
          s.manifest.contract,
          senryoBinaryV1Abi,
          "buy",
          [s.roundId, s.isUp, minOut, deadline, r.operationId],
          "binaryBuy",
          { value: amount, meta },
        )
      : externalCall(
          s.manifest.contract,
          senryoBinaryV1Abi,
          "sell",
          [s.roundId, s.isUp, amount, minOut, deadline, r.operationId],
          "binarySell",
          { meta },
        );
  return bind(req, s, r, read, (fresh) => {
    if (
      fresh.timestamp >= deadline ||
      deadline > fresh.timestamp + BigInt(BINARY_POLICY.quoteSeconds) ||
      fresh.timestamp >= fresh.round.cutoff ||
      fresh.round.state !== BINARY_STATE.Open ||
      (s.action === "buy" && fresh.riskPaused)
    )
      throw new Error("binary: review expired or round closed");
    if (s.action === "sell" && amount > (s.isUp ? fresh.position.up : fresh.position.down))
      throw new Error("binary: shares changed");
    // Changed reserves require a fresh review rather than silently changing quoted economics.
    if (fresh.round.revision !== s.quote.revision) throw new Error("binary: quote revision changed");
  });
}
export function buildBinaryClaim(read: ReadClient, s: BinarySnapshot, r: BinaryReview): TxRequest {
  const check = (x: BinarySnapshot) => {
    if (x.position.up !== s.position.up || x.position.down !== s.position.down)
      throw new Error("binary: reviewed holdings changed");
    if (x.round.state < BINARY_STATE.Up || x.position.up + x.position.down === 0n)
      throw new Error("binary: no finalized shares");
  };
  check(s);
  return bind(
    externalCall(s.manifest.contract, senryoBinaryV1Abi, "claim", [s.roundId, r.operationId], "binaryClaim", {
      meta: metadata(s, "claim", r.operationId),
    }),
    s,
    r,
    read,
    check,
  );
}
export function buildBinaryWithdraw(read: ReadClient, s: BinarySnapshot, r: BinaryReview, amount: bigint): TxRequest {
  const check = (x: BinarySnapshot) => {
    if (amount <= 0n || amount > x.creditWei) throw new Error("binary: credit unavailable");
  };
  check(s);
  return bind(
    externalCall(s.manifest.contract, senryoBinaryV1Abi, "withdraw", [amount, r.operationId], "binaryWithdraw", {
      meta: { ...metadata(s, "withdraw", r.operationId), amount: String(amount) },
    }),
    s,
    r,
    read,
    check,
  );
}
/** Permissionless boundary/timeout calls have no onchain operation marker; the shared signed journal owns recovery. */
export async function buildBinarySettlement(
  read: ReadClient,
  s: BinarySnapshot,
  r: BinaryReview,
  action: "recordOpening" | "resolve" | "voidExpired" | "claimLiquidity",
  proof: readonly Hex[] = [],
): Promise<TxRequest> {
  review(s, r);
  const { readBinaryProofFee } = await import("./binary-reads.ts");
  const boundary = action === "recordOpening" || action === "resolve";
  const fee = boundary ? await readBinaryProofFee(read, s.manifest, s.environment, proof) : 0n;
  const check = (x: BinarySnapshot) => {
    const t = x.timestamp,
      round = x.round;
    if (
      action === "recordOpening" &&
      (round.state !== BINARY_STATE.Scheduled ||
        t < round.start ||
        t >= round.start + BigInt(BINARY_POLICY.openingDeadline))
    )
      throw new Error("binary: opening unavailable");
    if (
      action === "resolve" &&
      (round.state !== BINARY_STATE.Open || t < round.end || t >= round.end + BigInt(BINARY_POLICY.closingDeadline))
    )
      throw new Error("binary: resolution unavailable");
    if (
      action === "voidExpired" &&
      (!(
        [
          BINARY_STATE.Scheduled,
          BINARY_STATE.Open,
          BINARY_STATE.OpeningInvalid,
          BINARY_STATE.ClosingInvalid,
        ] as readonly number[]
      ).includes(round.state) ||
        t <
          (([BINARY_STATE.Scheduled, BINARY_STATE.OpeningInvalid] as readonly number[]).includes(round.state)
            ? round.start + BigInt(BINARY_POLICY.openingDeadline)
            : round.end + BigInt(BINARY_POLICY.closingDeadline)))
    )
      throw new Error("binary: timeout unavailable");
    if (action === "claimLiquidity" && (round.state < BINARY_STATE.Up || round.up + round.down === 0n))
      throw new Error("binary: liquidity unavailable");
  };
  check(s);
  const meta = { ...metadata(s, action, r.operationId), oracleFeeWei: String(fee) };
  const req = boundary
    ? externalCall(s.manifest.contract, senryoBinaryV1Abi, action, [s.roundId, proof], "binaryBoundary", {
        value: fee,
        meta,
      })
    : externalCall(
        s.manifest.contract,
        senryoBinaryV1Abi,
        action,
        [s.roundId],
        action === "voidExpired" ? "binaryVoid" : "binaryLiquidity",
        { meta },
      );
  const bound = bind(req, s, r, read, check),
    validate = bound.validate;
  return {
    ...bound,
    validate: async () => {
      await validate?.();
      await verifyBinarySource(read, s.manifest, s.environment);
      if (boundary && (await readBinaryProofFee(read, s.manifest, s.environment, proof)) !== fee)
        throw new Error("binary: oracle fee changed; review again");
    },
  };
}
