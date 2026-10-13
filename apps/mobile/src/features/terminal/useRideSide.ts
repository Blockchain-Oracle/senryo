/**
 * The phone terminal's ride side (R5.4–R5.5; the web's `useRideSide`): this market's ride terms on the active network,
 * the leverage held to its cap, the rider's newest open ride here, the live pass (`useLiveRide`) and the flow
 * (`useRideFlow`). Practice rides on the phone; Real rides are web-only until S9 (D-305).
 */

import type { Caller } from "@senryo/calls";
import { leverageFor, rideKey, ridesOn } from "@senryo/calls";
import { type CallFlowEffects, useRideFlow, useSelectedPosition } from "@senryo/calls/react";
import { useQueryEnv, useRideCatalog, useRides } from "@senryo/query";
import { useMemo } from "react";
import { useLiveRide } from "./useLiveRide";
import type { TerminalChoices } from "./useTerminalChoices";

const OPEN = new Set(["committed", "open", "closing"]);
const ONE_X = 10_000;

export function useRideSide(i: {
  symbol: string;
  account: Caller;
  choices: TerminalChoices;
  active: boolean;
  balance: bigint | undefined;
  nowSec: number;
  effects: CallFlowEffects;
}) {
  const env = useQueryEnv();
  const owner = i.account.hint?.address;
  const catalog = useRideCatalog();
  const rides = useRides(owner);
  const market = "value" in catalog ? catalog.value.markets.find((m) => m.symbol === i.symbol) : undefined;
  const deployed = "value" in catalog && catalog.value.deployed;
  const terms = useMemo(
    () => ("value" in catalog && market ? { ...catalog.value.terms, takerFeeBps: market.takerFeeBps } : undefined),
    [catalog, market],
  );
  const leverageBps = leverageFor(i.choices.leverageX, market?.maxLeverageBps ?? ONE_X);
  // The selected ride when it's open here (an older one, D-343), else the newest.
  const selected = useSelectedPosition();
  const held = useMemo(() => {
    if (!("value" in rides)) return undefined;
    const open = rides.value.rides
      .filter((r) => r.symbol === i.symbol && OPEN.has(r.state))
      .sort((a, b) => (b.rideId > a.rideId ? 1 : -1));
    return open.find((r) => rideKey(r.rideId) === selected) ?? open[0];
  }, [rides, i.symbol, selected]);
  const live = useLiveRide({
    symbol: i.symbol,
    margin: i.choices.margin,
    leverageBps,
    terms,
    held,
    trailBps: i.choices.rideTrailBps,
    active: i.active,
  });
  const flow = useRideFlow({
    symbol: i.symbol,
    caller: i.account,
    owner,
    margin: i.choices.margin,
    leverageBps,
    takerFeeBps: market?.takerFeeBps,
    balance: i.balance,
    nowSec: i.nowSec,
    held,
    latest: live.latest,
    trailBps: i.choices.rideTrailBps,
    effects: i.effects,
  });
  return {
    live,
    flow,
    held,
    terms,
    market,
    leverageBps,
    /** This market rides here (listed and deployed on the active network). */
    available: ridesOn(i.symbol) && market !== undefined && deployed,
    deployed,
    chainId: env.chainId,
  };
}

export type RideSide = ReturnType<typeof useRideSide>;
