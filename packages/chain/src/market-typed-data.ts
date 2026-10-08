/**
 * EIP-712 for the markets (D-266, D-267), field for field as `contracts/src/markets/SessionGrants.sol` hashes them, so
 * the phone, the web and the relay sign and check one definition. Domain: "Senryo Markets" v1 on the reserve.
 */
import type { ChainId } from "@senryo/config";
import { type Address, bytesToBigInt, type Hex, hashTypedData } from "viem";
import { addressOf } from "./contracts.ts";

export const MARKETS_DOMAIN_NAME = "Senryo Markets";
export const MARKETS_DOMAIN_VERSION = "1";

export function marketsDomain(chainId: ChainId) {
  return {
    name: MARKETS_DOMAIN_NAME,
    version: MARKETS_DOMAIN_VERSION,
    chainId,
    verifyingContract: addressOf(chainId, "BandReserve"),
  } as const;
}

export const INTENT_TYPES = {
  Intent: [
    { name: "action", type: "uint8" },
    { name: "owner", type: "address" },
    { name: "windowId", type: "bytes32" },
    { name: "band", type: "uint8" },
    { name: "ticketId", type: "uint256" },
    { name: "amount", type: "uint64" },
    { name: "limit", type: "uint64" },
    { name: "recipient", type: "address" },
    { name: "configVersion", type: "uint32" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "epoch", type: "uint32" },
  ],
} as const;

export const SESSION_GRANT_TYPES = {
  SessionGrant: [
    { name: "owner", type: "address" },
    { name: "delegate", type: "address" },
    { name: "perCallCap", type: "uint64" },
    { name: "sessionCap", type: "uint64" },
    { name: "expiry", type: "uint40" },
    { name: "epoch", type: "uint32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const REVOKE_TYPES = {
  Revoke: [
    { name: "owner", type: "address" },
    { name: "epoch", type: "uint32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

const NONCE_BYTES = 32;

export const ACTION_OPEN = 1;
export const ACTION_CLOSE = 2;

export interface MarketIntent {
  action: number;
  owner: Address;
  windowId: Hex;
  band: number;
  ticketId: bigint;
  amount: bigint;
  limit: bigint;
  recipient: Address;
  configVersion: number;
  deadline: bigint;
  nonce: bigint;
  epoch: number;
}

export interface MarketSessionGrant {
  owner: Address;
  delegate: Address;
  perCallCap: bigint;
  sessionCap: bigint;
  expiry: bigint;
  epoch: number;
  nonce: bigint;
}

/** The digest the owner or session delegate signs; also the relay's idempotency key. */
export function intentDigest(chainId: ChainId, intent: MarketIntent): Hex {
  return hashTypedData({ domain: marketsDomain(chainId), types: INTENT_TYPES, primaryType: "Intent", message: intent });
}

export function sessionGrantDigest(chainId: ChainId, grant: MarketSessionGrant): Hex {
  return hashTypedData({
    domain: marketsDomain(chainId),
    types: SESSION_GRANT_TYPES,
    primaryType: "SessionGrant",
    message: { ...grant, expiry: Number(grant.expiry) },
  });
}

/** A unique unordered nonce (the contract keeps a bitmap; any unused 256-bit value works). */
export function freshNonce(): bigint {
  return bytesToBigInt(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
}
