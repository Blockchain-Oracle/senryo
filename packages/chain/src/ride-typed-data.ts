/**
 * EIP-712 for rides and σ marks (v3: D-299, D-300), field for field as `contracts/src/markets/LinearBook.sol` and
 * `SigmaMarks.sol` hash them, under the reserve's "Senryo Markets" domain — so the apps sign a ride, and the keeper and
 * the relay sign marks, against one definition. Pinned to Foundry's digests (`packages/core/vectors/typed-data.json`).
 */
import type { ChainId } from "@senryo/config";
import { type Address, type Hex, hashTypedData } from "viem";
import { marketsDomain } from "./market-typed-data.ts";
import type { Signer } from "./signer.ts";

export const RIDE_INTENT_TYPES = {
  RideIntent: [
    { name: "action", type: "uint8" },
    { name: "owner", type: "address" },
    { name: "marketId", type: "uint16" },
    { name: "isLong", type: "bool" },
    { name: "rideId", type: "uint256" },
    { name: "margin", type: "uint64" },
    { name: "leverageBps", type: "uint32" },
    { name: "size", type: "uint128" },
    { name: "worstPriceE8", type: "int64" },
    { name: "recipient", type: "address" },
    { name: "configVersion", type: "uint32" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "epoch", type: "uint32" },
  ],
} as const;

export const SIGMA_MARK_TYPES = {
  SigmaMark: [
    { name: "feedId", type: "bytes32" },
    { name: "minute", type: "uint40" },
    { name: "fastE8", type: "uint64" },
    { name: "slowE8", type: "uint64" },
  ],
} as const;

/** OPEN: `margin` at `leverageBps`; CLOSE: `size` of `rideId` (0 = all). Fills at the next print within `worstPriceE8`. */
export interface RideIntent {
  action: number;
  owner: Address;
  marketId: number;
  isLong: boolean;
  rideId: bigint;
  margin: bigint;
  leverageBps: number;
  size: bigint;
  worstPriceE8: bigint;
  recipient: Address;
  configVersion: number;
  deadline: bigint;
  nonce: bigint;
  epoch: number;
}

/** The keeper's σ for one feed through one minute boundary (σ per √second × 1e8): the fast EWMA and the slow anchor. */
export interface SigmaMark {
  feedId: Hex;
  minute: number;
  fastE8: bigint;
  slowE8: bigint;
}

/** The typed-data domain, or one given (vectors, forks). */
type Domain =
  | ReturnType<typeof marketsDomain>
  | { name: string; version: string; chainId: number; verifyingContract: Address };

export const rideIntentRequest = (domain: Domain, message: RideIntent) =>
  ({ domain, types: RIDE_INTENT_TYPES, primaryType: "RideIntent", message }) as const;

export const sigmaMarkRequest = (domain: Domain, message: SigmaMark) =>
  ({ domain, types: SIGMA_MARK_TYPES, primaryType: "SigmaMark", message }) as const;

export const rideIntentDigest = (chainId: ChainId, it: RideIntent): Hex =>
  hashTypedData(rideIntentRequest(marketsDomain(chainId), it));

export const sigmaMarkDigest = (chainId: ChainId, m: SigmaMark): Hex =>
  hashTypedData(sigmaMarkRequest(marketsDomain(chainId), m));

/** A σ mark with an allowed signer's signature, as `finalize` and `finalizeParlay` take it. */
export interface SignedSigmaMark {
  mark: SigmaMark;
  signature: Hex;
}

/** Signs `mark` under `chainId`'s reserve domain (the keeper's and the relay's keys are allowed signers). */
export async function signSigmaMark(signer: Signer, chainId: ChainId, mark: SigmaMark): Promise<SignedSigmaMark> {
  return { mark, signature: await signer.signTypedData(sigmaMarkRequest(marketsDomain(chainId), mark)) };
}
