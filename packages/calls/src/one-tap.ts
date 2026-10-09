/**
 * One-tap calls (D-267, D-280): the owner signs one `SessionGrant` under Face ID naming a fresh delegate key made on
 * this device, plus a permit for the session's whole cap when the allowance is short, so no later call needs one.
 * Ending it signs a `Revoke` (the epoch bumps: every outstanding signature dies) and forgets the key.
 */
import type { AccountClient, DelegateKeys, Hex } from "@senryo/account";
import {
  freshNonce,
  type MarketSessionGrant,
  permitParts,
  permitRequest,
  revokeRequest,
  sessionGrantRequest,
} from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { INTENT_TTL_SEC, PERMIT_TTL_SEC, PROMPTS } from "./constants.ts";
import type { AccountView, Permit } from "./sign.ts";

export interface OneTapTerms {
  perCallCap: bigint;
  sessionCap: bigint;
  seconds: number;
}

export interface SignedGrant {
  grant: MarketSessionGrant;
  signature: Hex;
  permit: Permit | null;
}

interface Deps {
  chainId: ChainId;
  client: AccountClient;
  delegates: DelegateKeys;
  reserve: `0x${string}`;
  owner: `0x${string}`;
  account: AccountView;
  nowSec: number;
}

export async function signOneTap(d: Deps, terms: OneTapTerms): Promise<SignedGrant> {
  const delegate = await d.delegates.create(d.owner, d.chainId);
  const grant: MarketSessionGrant = {
    owner: d.owner,
    delegate: delegate.address,
    perCallCap: terms.perCallCap,
    sessionCap: terms.sessionCap,
    expiry: BigInt(d.nowSec + terms.seconds),
    epoch: d.account.epoch,
    nonce: freshNonce(),
  };
  const needsPermit = d.account.allowance < terms.sessionCap;
  try {
    return await d.client.stepUp(async (owner) => {
      let permit: Permit | null = null;
      if (needsPermit) {
        const deadline = BigInt(d.nowSec + PERMIT_TTL_SEC);
        const sig = await owner.signTypedData(
          permitRequest(d.chainId, {
            owner: d.owner,
            spender: d.reserve,
            value: terms.sessionCap,
            nonce: d.account.permitNonce,
            deadline,
          }),
        );
        permit = { value: terms.sessionCap, deadline, ...permitParts(sig) };
      }
      const signature = await owner.signTypedData(sessionGrantRequest(d.chainId, grant));
      return { grant, signature, permit };
    }, PROMPTS.oneTap);
  } catch (error) {
    await d.delegates.forget(d.owner, d.chainId);
    throw error;
  }
}

export interface SignedRevoke {
  nonce: bigint;
  deadline: bigint;
  signature: Hex;
}

export async function signRevoke(d: Deps): Promise<SignedRevoke> {
  const nonce = freshNonce();
  const deadline = BigInt(d.nowSec + INTENT_TTL_SEC);
  const signature = await d.client.stepUp(
    (owner) =>
      owner.signTypedData(revokeRequest(d.chainId, { owner: d.owner, epoch: d.account.epoch, nonce, deadline })),
    PROMPTS.revoke,
  );
  return { nonce, deadline, signature };
}
