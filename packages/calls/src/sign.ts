/**
 * Who signs a call (D-280): the one-tap delegate when this device holds the key a live grant names and the call fits
 * its caps (opens spend the caps; closes don't) — no prompt at all; otherwise the owner, one Face ID for the intent and,
 * when the reserve's allowance is short, a permit for exactly this stake in the same prompt.
 */
import type { AccountClient, DelegateKeys, Hex, LocalAccount } from "@senryo/account";
import {
  ACTION_OPEN,
  addressOf,
  duelEntryRequest,
  duelPickRequest,
  eventCallRequest,
  exitOrderRequest,
  freshNonce,
  freshSeed,
  intentRequest,
  type MarketDuelEntry,
  type MarketDuelPick,
  type MarketEventCall,
  type MarketExitOrder,
  type MarketIntent,
  type MarketParlayIntent,
  parlayRequest,
  permitParts,
  permitRequest,
} from "@senryo/chain";
import { type ChainId, DUEL, EVENTS } from "@senryo/config";
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

/** This device's delegate, if a live grant names it. */
async function liveDelegate(d: SignDeps, owner: `0x${string}`): Promise<LocalAccount | undefined> {
  const s = d.account.session;
  if (!s || s.expiry - d.nowSec <= SESSION_MARGIN_SEC) return undefined;
  const key = await d.delegates.get(owner, d.chainId);
  return key && key.address.toLowerCase() === s.delegate.toLowerCase() ? key : undefined;
}

/** This device's delegate, if a live grant names it and `spend` (0 for a close) fits what it may still sign. */
async function oneTapFor(d: SignDeps, owner: `0x${string}`, spend: bigint): Promise<LocalAccount | undefined> {
  const s = d.account.session;
  const key = await liveDelegate(d, owner);
  if (!key || !s) return undefined;
  if (spend === 0n) return key;
  const fits = spend <= s.perCallCap && s.spent + spend <= s.sessionCap;
  return fits && d.account.allowance >= spend ? key : undefined;
}

/** This device's delegate, if a live grant names it and `draft` fits what it may still sign. */
export const oneTapSigner = (d: SignDeps, draft: CallDraft): Promise<LocalAccount | undefined> =>
  oneTapFor(d, draft.owner, draft.action === ACTION_OPEN ? draft.amount : 0n);

/**
 * One signature for `spend` dollars: one-tap if it may, else the owner under one Face ID showing `prompt` — with, when
 * the reserve's allowance is short, a permit for exactly `spend` in the same prompt.
 */
async function signSpend<T>(
  d: SignDeps,
  owner: `0x${string}`,
  spend: bigint,
  prompt: string,
  sign: (signer: LocalAccount) => Promise<T>,
): Promise<{ signed: T; permit: Permit | null; via: "one-tap" | "face-id" }> {
  const delegate = await oneTapFor(d, owner, spend);
  if (delegate) return { signed: await sign(delegate), permit: null, via: "one-tap" };
  return d.client.stepUp(async (signer) => {
    let permit: Permit | null = null;
    if (spend > 0n && d.account.allowance < spend) {
      const deadline = BigInt(d.nowSec + PERMIT_TTL_SEC);
      const sig = await signer.signTypedData(
        permitRequest(d.chainId, { owner, spender: d.reserve, value: spend, nonce: d.account.permitNonce, deadline }),
      );
      permit = { value: spend, deadline, ...permitParts(sig) };
    }
    return { signed: await sign(signer), permit, via: "face-id" as const };
  }, prompt);
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
  const spend = draft.action === ACTION_OPEN ? draft.amount : 0n;
  const r = await signSpend(d, draft.owner, spend, prompt, (signer) =>
    signer.signTypedData(intentRequest(d.chainId, intent)),
  );
  return { intent, signature: r.signed, permit: r.permit, via: r.via };
}

export type ParlayDraft = Omit<MarketParlayIntent, "deadline" | "nonce" | "epoch" | "recipient">;

export interface SignedParlay {
  intent: MarketParlayIntent;
  signature: Hex;
  permit: Permit | null;
  via: "one-tap" | "face-id";
}

/** Sign a parlay (D-293): its stake spends like an open's — one-tap within the caps, else one Face ID. */
export async function signParlay(d: SignDeps, draft: ParlayDraft, prompt: string): Promise<SignedParlay> {
  const intent: MarketParlayIntent = {
    ...draft,
    recipient: draft.owner,
    deadline: BigInt(d.nowSec + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: d.account.epoch,
  };
  const r = await signSpend(d, draft.owner, draft.stake, prompt, (signer) =>
    signer.signTypedData(parlayRequest(d.chainId, intent)),
  );
  return { intent, signature: r.signed, permit: r.permit, via: r.via };
}

export type ExitDraft = Omit<MarketExitOrder, "deadline" | "nonce" | "epoch">;

export interface SignedExit {
  order: MarketExitOrder;
  signature: Hex;
  via: "one-tap" | "face-id";
}

/** Sign an exit (D-292): one-tap when this device's delegate is live — it stays after the session ends — else Face ID. */
export async function signExit(d: SignDeps, draft: ExitDraft, prompt: string): Promise<SignedExit> {
  const order: MarketExitOrder = {
    ...draft,
    deadline: BigInt(d.nowSec + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: d.account.epoch,
  };
  const delegate = await liveDelegate(d, draft.owner);
  if (delegate) {
    return { order, signature: await delegate.signTypedData(exitOrderRequest(d.chainId, order)), via: "one-tap" };
  }
  return d.client.stepUp(
    async (owner) => ({
      order,
      signature: await owner.signTypedData(exitOrderRequest(d.chainId, order)),
      via: "face-id" as const,
    }),
    prompt,
  );
}

export interface SignedDuelEntry {
  entry: MarketDuelEntry;
  signature: Hex;
  permit: Permit;
}

/**
 * Sign a duel entry (D-294): it spends the pot and every card's stake, so always the owner — one Face ID for the
 * entry and a permit of exactly `cost` to the arena, good as long as the entry. The seat's key is this device's
 * delegate (made now if there is none), so the swipes need no prompt.
 */
export async function signDuelEntry(
  d: SignDeps,
  draft: { owner: `0x${string}`; tier: number; cost: bigint },
  prompt: string,
): Promise<SignedDuelEntry> {
  const key = (await d.delegates.get(draft.owner, d.chainId)) ?? (await d.delegates.create(draft.owner, d.chainId));
  const deadline = BigInt(d.nowSec + DUEL.entryTtlSec);
  const entry: MarketDuelEntry = {
    owner: draft.owner,
    tier: draft.tier,
    delegate: key.address,
    seed: freshSeed(),
    deadline,
    nonce: freshNonce(),
    epoch: d.account.epoch,
  };
  const arena = addressOf(d.chainId, "DuelArena");
  return d.client.stepUp(async (signer) => {
    const permitSig = await signer.signTypedData(
      permitRequest(d.chainId, {
        owner: draft.owner,
        spender: arena,
        value: draft.cost,
        nonce: d.account.permitNonce,
        deadline,
      }),
    );
    const signature = await signer.signTypedData(duelEntryRequest(d.chainId, entry));
    return { entry, signature, permit: { value: draft.cost, deadline, ...permitParts(permitSig) } };
  }, prompt);
}

/** Sign a swipe: this device's seat key when the entry named it, else the owner under one Face ID. */
export async function signDuelPick(
  d: Pick<SignDeps, "chainId" | "client" | "delegates">,
  pick: MarketDuelPick,
  seatKey: string | null,
  prompt: string,
): Promise<{ signature: Hex; via: "one-tap" | "face-id" }> {
  const key = await d.delegates.get(pick.player, d.chainId);
  if (key && seatKey && key.address.toLowerCase() === seatKey.toLowerCase()) {
    return { signature: await key.signTypedData(duelPickRequest(d.chainId, pick)), via: "one-tap" };
  }
  return d.client.stepUp(
    async (owner) => ({
      signature: await owner.signTypedData(duelPickRequest(d.chainId, pick)),
      via: "face-id" as const,
    }),
    prompt,
  );
}

export interface SignedEventCall {
  call: MarketEventCall;
  signature: Hex;
  permit: Permit;
}

/**
 * Sign a yes/no call (D-296): the stake can't be cashed out, so always the owner — one Face ID for the call and a
 * permit of exactly the stake to the event book (finite, D-266), both good for as long as the call.
 */
export async function signEventCall(
  d: Pick<SignDeps, "chainId" | "client" | "account" | "nowSec">,
  draft: { owner: `0x${string}`; eventId: Hex; yes: boolean; stake: bigint },
  prompt: string,
): Promise<SignedEventCall> {
  const deadline = BigInt(d.nowSec + EVENTS.callTtlSec);
  const call: MarketEventCall = {
    ...draft,
    deadline,
    nonce: freshNonce(),
    epoch: d.account.epoch,
  };
  const book = addressOf(d.chainId, "EventBook");
  return d.client.stepUp(async (signer) => {
    const permitSig = await signer.signTypedData(
      permitRequest(d.chainId, {
        owner: draft.owner,
        spender: book,
        value: draft.stake,
        nonce: d.account.permitNonce,
        deadline,
      }),
    );
    const signature = await signer.signTypedData(eventCallRequest(d.chainId, call));
    return { call, signature, permit: { value: draft.stake, deadline, ...permitParts(permitSig) } };
  }, prompt);
}
