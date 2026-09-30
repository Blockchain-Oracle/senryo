/**
 * EIP-7702 spike (Mera composability bonus, D-030; findings in decisions.md). Mera's `toViemAccount` implements
 * `signAuthorization`, so the passkey EOA can delegate to an audited smart-account implementation and have a sponsor
 * pay gas (type-4 transaction). Here: the **signed authorization only**, always behind a step-up (spec: 7702 = step-up).
 * Sending the type-4 transaction is `packages/chain`'s job (S3) — this package never sends.
 *
 * Delegates verified by `eth_getCode` (read-only, 2026-09-30):
 *  - eth-infinitism `Simple7702Account` (ERC-4337 v0.8, EntryPoint 0x4337…f108): mainnet ✓ · testnet ✗
 *  - MetaMask Delegation Framework `EIP7702StatelessDeleGator` (EntryPoint v0.7 0x…da032): mainnet ✓ · testnet ✓
 * Monad caveats (context/02-monad/differences-from-ethereum.md §2, §9): a delegated EOA can never dip below 10 MON by a
 * value-decreasing transaction (fine for a sponsored, ~0-MON trading account), and code running as the EOA cannot
 * CREATE/CREATE2. Clearing = a type-4 authorization to the zero address.
 */
import type { SignedAuthorization } from "viem";
import { type Address, zeroAddress } from "viem";
import type { AccountClient } from "./client.ts";

export const DELEGATES = {
  /** eth-infinitism Simple7702Account (account-abstraction v0.8). */
  simple7702Account: "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9",
  /** MetaMask Delegation Framework EIP7702StatelessDeleGator. */
  metamaskStatelessDeleGator: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
} as const satisfies Record<string, Address>;

export interface DelegationRequest {
  chainId: number;
  /** Implementation to delegate to; `zeroAddress` clears an existing delegation. */
  contract: Address;
  /**
   * The EOA's account nonce the authorization is valid for. If the EOA itself sends the type-4 transaction, this is
   * the transaction nonce + 1 (viem `executor: "self"`); if a sponsor sends it, the EOA's current nonce.
   */
  nonce: number;
}

/** Signs an EIP-7702 authorization with a fresh passkey ceremony (never inside the scoped session). */
export function signDelegation(client: AccountClient, request: DelegationRequest): Promise<SignedAuthorization> {
  return client.stepUp(async (signer) => {
    if (!signer.signAuthorization) throw new Error("This signer cannot sign EIP-7702 authorizations");
    return signer.signAuthorization({
      contractAddress: request.contract,
      chainId: request.chainId,
      nonce: request.nonce,
    });
  });
}

export const clearDelegation = (chainId: number, nonce: number): DelegationRequest => ({
  chainId,
  contract: zeroAddress,
  nonce,
});
