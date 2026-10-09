/**
 * Who signs a call (D-280): the one-tap delegate when this device holds the key a live grant names and the call fits
 * its caps (opens spend the caps; closes don't) — no prompt at all; otherwise the owner, one Face ID for the intent and,
 * when the reserve's allowance is short, a permit for exactly this stake in the same prompt.
 */
import type { AccountClient, DelegateKeys, Hex, LocalAccount } from "@senryo/account";
import { ACTION_OPEN, freshNonce, intentRequest, type MarketIntent, permitParts, permitRequest } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { INTENT_TTL_SEC, PERMIT_TTL_SEC, SESSION_MARGIN_SEC } from "./constants.ts";

/** What `/v1/markets/account` says about the caller (balance, allowance, permit nonce, epoch, session). */
export interface AccountView {
  allowance: bigint;
  permitNonce: bigint;
  epoch: number;
  session: { delegate: string; expiry: number; perCallCap: bigint; sessionCap: bigint; spent: bigint } | null;
}

export interface Permit {
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

export interface SignedCall {
  intent: MarketIntent;
  signature: Hex;
  permit: Permit | null;
  via: "one-tap" | "face-id";
}

export type CallDraft = Omit<MarketIntent, "deadline" | "nonce" | "epoch" | "recipient">;

export interface SignDeps {
  chainId: ChainId;
  client: AccountClient;
  delegates: DelegateKeys;
  reserve: `0x${string}`;
  account: AccountView;
  nowSec: number;
}

/** This device's delegate, if a live grant names it and `draft` fits what it may still sign. */
export async function oneTapSigner(d: SignDeps, draft: CallDraft): Promise<LocalAccount | undefined> {
  const s = d.account.session;
  if (!s || s.expiry - d.nowSec <= SESSION_MARGIN_SEC) return undefined;
  const key = await d.delegates.get(draft.owner, d.chainId);
  if (!key || key.address.toLowerCase() !== s.delegate.toLowerCase()) return undefined;
  if (draft.action !== ACTION_OPEN) return key;
  const fits = draft.amount <= s.perCallCap && s.spent + draft.amount <= s.sessionCap;
  return fits && d.account.allowance >= draft.amount ? key : undefined;
}

/** Sign a call: one-tap if it may, else the owner under one Face ID showing `prompt`. */
export async function signCall(d: SignDeps, draft: CallDraft, prompt: string): Promise<SignedCall> {
  const intent: MarketIntent = {
    ...draft,
    recipient: draft.owner,
    deadline: BigInt(d.nowSec + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: d.account.epoch,
  };
  const delegate = await oneTapSigner(d, draft);
  if (delegate) {
    const signature = await delegate.signTypedData(intentRequest(d.chainId, intent));
    return { intent, signature, permit: null, via: "one-tap" };
  }
  const needsPermit = draft.action === ACTION_OPEN && d.account.allowance < draft.amount;
  return d.client.stepUp(async (owner) => {
    let permit: Permit | null = null;
    if (needsPermit) {
      const deadline = BigInt(d.nowSec + PERMIT_TTL_SEC);
      const sig = await owner.signTypedData(
        permitRequest(d.chainId, {
          owner: draft.owner,
          spender: d.reserve,
          value: draft.amount,
          nonce: d.account.permitNonce,
          deadline,
        }),
      );
      permit = { value: draft.amount, deadline, ...permitParts(sig) };
    }
    const signature = await owner.signTypedData(intentRequest(d.chainId, intent));
    return { intent, signature, permit, via: "face-id" as const };
  }, prompt);
}
