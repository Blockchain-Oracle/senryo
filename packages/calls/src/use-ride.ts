/**
 * Ride actions (D-299, R5): open a ride or close one, signed by the one-tap delegate within its caps or the owner under
 * one passkey prompt, relayed gas-free; both fill at the next unique print within the price-terms slippage limit
 * (D-300). The relay answers with the intent's digest at once; its status arrives on the stream (`useIntentStatus`),
 * and the ride book follows the user's `ride` events.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import type { IntentStatus } from "@senryo/api-client";
import { ACTION_CLOSE, ACTION_OPEN, MARKETS, RIDE_MARKETS, slippageE6, worstPriceE8 } from "@senryo/config";
import { rideFee, rideNotional } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCatalog, useMarketAccount, useQueryEnv, useRideCatalog, useSubmitRide } from "@senryo/query";
import { useCallback } from "react";
import type { Caller } from "./caller.ts";
import type { RideDraft, SignDeps } from "./sign.ts";

const signing = () => Promise.all([import("./sign.ts"), import("./delegates.ts")]);

export type RideResult = { kind: "sent"; status: IntentStatus; via: "one-tap" | "face-id" } | { kind: "cancelled" };

export interface RideOpenArgs {
  symbol: string;
  isLong: boolean;
  margin: bigint;
  leverageBps: number;
  /** The price the rider saw; the fill may be worse by the slippage limit at most. */
  markE8: bigint;
}

export interface RideCloseArgs {
  rideId: bigint;
  symbol: string;
  isLong: boolean;
  markE8: bigint;
}

/** Ride prompts (the OS sheet over the terminal). */
const PROMPT = {
  open: (isLong: boolean, symbol: string) => `Ride ${symbol} ${isLong ? "Up" : "Down"}`,
  close: "Close the ride",
} as const;

/** What an open takes from the wallet: the margin and the open fee (contracts `commitRide`, at the taker rate). */
export function rideOpenCost(margin: bigint, leverageBps: number, takerFeeBps: number): bigint {
  return margin + rideFee(rideNotional(margin, BigInt(leverageBps)), BigInt(takerFeeBps));
}

const slipOf = (symbol: string): bigint => {
  const m = MARKETS.find((x) => x.symbol === symbol);
  return m ? slippageE6(m) : 0n;
};

export function useRideActions({ client, hint }: Caller) {
  const env = useQueryEnv();
  const live = useLive();
  const owner = hint?.address;
  const catalog = useCatalog();
  const rides = useRideCatalog();
  const account = useMarketAccount(owner);
  const submit = useSubmitRide();
  const ready = Boolean(
    client && owner && "value" in catalog && "value" in account && "value" in rides && rides.value.deployed,
  );

  const send = useCallback(
    async (draft: Omit<RideDraft, "owner" | "configVersion">, spend: bigint, prompt: string): Promise<RideResult> => {
      if (!client || !owner || !("value" in catalog) || !("value" in account)) throw new Error("Not ready to ride");
      const [{ signRide }, { appDelegates }] = await signing();
      const deps: SignDeps = {
        chainId: env.chainId,
        client,
        delegates: appDelegates(),
        reserve: catalog.value.contracts.reserve,
        account: account.value,
        nowSec: live.clock.nowSec(),
      };
      try {
        const signed = await signRide(
          deps,
          { ...draft, owner, configVersion: catalog.value.configVersion },
          spend,
          prompt,
        );
        const status = await submit.mutateAsync({
          intent: { ...signed.intent, action: signed.intent.action as 1 | 2 },
          signature: signed.signature,
          permit: signed.permit,
        });
        return { kind: "sent", status, via: signed.via };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return { kind: "cancelled" };
        throw error;
      }
    },
    [client, owner, catalog, account, env.chainId, live, submit],
  );

  const open = useCallback(
    (a: RideOpenArgs) => {
      const marketId = RIDE_MARKETS.indexOf(a.symbol as (typeof RIDE_MARKETS)[number]);
      const terms = "value" in rides ? rides.value.markets.find((m) => m.symbol === a.symbol) : undefined;
      if (marketId < 0 || !terms) throw new Error(`${a.symbol} doesn't ride`);
      return send(
        {
          action: ACTION_OPEN,
          marketId,
          isLong: a.isLong,
          rideId: 0n,
          margin: a.margin,
          leverageBps: a.leverageBps,
          size: 0n,
          // A long accepts a fill up to the limit above the price it saw, a short down to it below.
          worstPriceE8: worstPriceE8(a.markE8, slipOf(a.symbol), a.isLong),
        },
        rideOpenCost(a.margin, a.leverageBps, terms.takerFeeBps),
        PROMPT.open(a.isLong, a.symbol),
      );
    },
    [send, rides],
  );

  const close = useCallback(
    (a: RideCloseArgs) =>
      send(
        {
          action: ACTION_CLOSE,
          marketId: RIDE_MARKETS.indexOf(a.symbol as (typeof RIDE_MARKETS)[number]),
          isLong: a.isLong,
          rideId: a.rideId,
          margin: 0n,
          leverageBps: 0,
          // 0 closes all of it.
          size: 0n,
          // Closing a long sells: it accepts down to the limit below; a short's close buys back up to it above.
          worstPriceE8: worstPriceE8(a.markE8, slipOf(a.symbol), !a.isLong),
        },
        0n,
        PROMPT.close,
      ),
    [send],
  );

  return { ready, open, close, pending: submit.isPending };
}
