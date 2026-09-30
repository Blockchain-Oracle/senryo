import type { ChainId } from "@senryo/config";
import { type Address, type Hex, verifyMessage } from "viem";
import { createSiweMessage, generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";

/**
 * EIP-4361 sign-in for the API session (D-111). The server builds the exact message; the Mera EOA signs it; the
 * server checks every field (domain, nonce, expiry, chain) and recovers the signer with plain ECDSA (EOAs only).
 */

export interface SiweChallengeInput {
  address: Address;
  chainId: ChainId;
  /** RFC 3986 authority — the rpId host. */
  domain: string;
  /** The API origin the session is for. */
  uri: string;
  statement: string;
  nonce: string;
  issuedAt: Date;
  expirationTime: Date;
}

export function newSiweNonce(): string {
  return generateSiweNonce();
}

export function buildSiweMessage(input: SiweChallengeInput): string {
  return createSiweMessage({
    address: input.address,
    chainId: input.chainId,
    domain: input.domain,
    uri: input.uri,
    statement: input.statement,
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expirationTime: input.expirationTime,
    version: "1",
  });
}

export interface VerifiedSiwe {
  address: Address;
  chainId: number;
  nonce: string;
  expirationTime: Date | undefined;
}

/** Returns the verified fields, or undefined when any check fails (field mismatch, expired, bad signature). */
export async function verifySiweSignature(params: {
  message: string;
  signature: Hex;
  domain: string;
  statement: string;
  now?: Date | undefined;
}): Promise<VerifiedSiwe | undefined> {
  const fields = parseSiweMessage(params.message);
  if (!fields.address || !fields.nonce || fields.chainId === undefined) return undefined;
  if (fields.statement !== params.statement || !fields.expirationTime) return undefined;
  const valid = validateSiweMessage({ message: fields, domain: params.domain, time: params.now ?? new Date() });
  if (!valid) return undefined;
  const signed = await verifyMessage({ address: fields.address, message: params.message, signature: params.signature });
  if (!signed) return undefined;
  return {
    address: fields.address,
    chainId: fields.chainId,
    nonce: fields.nonce,
    expirationTime: fields.expirationTime,
  };
}
