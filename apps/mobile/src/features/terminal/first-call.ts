/**
 * A guest's first call on the phone (F14, the owner's video: sign last, not first): the call they picked waits here
 * while the account sheet makes their passkey; back on the terminal, `useFirstCall` adds the test dollars and places
 * that same call once they land — no re-tap, no setup detour first.
 */

import type { Address } from "@senryo/account";
import type { OfferSlot } from "@senryo/calls/react";
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { useEffect, useRef } from "react";
import { useSessionRunner } from "~/lib/account/use-session-runner";

export interface PendingCall {
  symbol: string;
  slot: OfferSlot;
  stake: bigint;
}

let pending: PendingCall | null = null;

export function holdFirstCall(call: PendingCall): void {
  pending = call;
}

/** Places the held call for `symbol` once there's an account and dollars enough; a guest who backs out keeps nothing. */
export function useFirstCall(symbol: string, owner: Address | undefined, place: (slot: OfferSlot) => void): void {
  const session = useSessionRunner();
  const grant = usePracticeGrant(owner, session);
  const account = useMarketAccount(owner);
  const asked = useRef(false);
  const placeRef = useRef(place);
  placeRef.current = place;
  const call = pending?.symbol === symbol ? pending : null;
  useEffect(() => {
    if (!call || !owner || !session || asked.current) return;
    asked.current = true;
    grant.mutate(undefined, { onError: () => undefined });
  }, [call, owner, session, grant]);
  const balance = "value" in account ? account.value.balance : undefined;
  useEffect(() => {
    if (!call || !owner || balance === undefined || balance < call.stake) return;
    pending = null;
    placeRef.current(call.slot);
  }, [call, owner, balance]);
}
