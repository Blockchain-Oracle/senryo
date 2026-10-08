/**
 * EIP-712 for the markets (D-266, D-267), field for field as `contracts/src/markets/SessionGrants.sol` hashes them, so
 * the phone, the web and the relay sign and check one definition. Domain: "Senryo Markets" v1 on the reserve.
 */
import { type ChainId, MAINNET_CHAIN_ID, TEST_USD_DOMAIN, USDC_DOMAIN } from "@senryo/config";
import { type Address, bytesToBigInt, bytesToHex, type Hex, hashTypedData, parseSignature } from "viem";
import { addressOf, dollarTokenOf } from "./contracts.ts";

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

// ------------------------------------------------------------------------------------------------ signing requests
// What the apps hand a signer (`signTypedData`): the owner's passkey under Face ID, or the session delegate.

export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** The dollar's EIP-712 domain: Circle USDC on mainnet, Test USD on Practice. */
export function dollarDomain(chainId: ChainId) {
  if (chainId === MAINNET_CHAIN_ID) return USDC_DOMAIN;
  const token = dollarTokenOf(chainId);
  if (!token) throw new Error(`no dollar token on ${chainId}`);
  return { ...TEST_USD_DOMAIN, chainId, verifyingContract: token } as const;
}

export interface PermitMessage {
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

/** EIP-2612: let the reserve pull `value` dollars (the allowance a call or a session spends). */
export const permitRequest = (chainId: ChainId, message: PermitMessage) =>
  ({ domain: dollarDomain(chainId), types: PERMIT_TYPES, primaryType: "Permit", message }) as const;

export const intentRequest = (chainId: ChainId, message: MarketIntent) =>
  ({ domain: marketsDomain(chainId), types: INTENT_TYPES, primaryType: "Intent", message }) as const;

export const sessionGrantRequest = (chainId: ChainId, grant: MarketSessionGrant) =>
  ({
    domain: marketsDomain(chainId),
    types: SESSION_GRANT_TYPES,
    primaryType: "SessionGrant",
    message: { ...grant, expiry: Number(grant.expiry) },
  }) as const;

export interface MarketRevoke {
  owner: Address;
  epoch: number;
  nonce: bigint;
  deadline: bigint;
}

export const revokeRequest = (chainId: ChainId, message: MarketRevoke) =>
  ({ domain: marketsDomain(chainId), types: REVOKE_TYPES, primaryType: "Revoke", message }) as const;

export const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** EIP-3009: move `value` dollars from the owner to `to`; anyone (the relay) may submit it — no MON needed. */
export interface TransferAuthorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
}

export const transferAuthRequest = (chainId: ChainId, message: TransferAuthorization) =>
  ({
    domain: dollarDomain(chainId),
    types: TRANSFER_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message,
  }) as const;

/** A fresh random 32-byte authorization nonce (EIP-3009 nonces are unordered). */
export function freshAuthNonce(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
}

/** A 65-byte signature as the permit argument `{ v, r, s }` the relay forwards. */
export function permitParts(signature: Hex): { v: number; r: Hex; s: Hex } {
  const p = parseSignature(signature);
  return { v: Number(p.v ?? BigInt(p.yParity + V_OFFSET)), r: p.r, s: p.s };
}

const V_OFFSET = 27;
