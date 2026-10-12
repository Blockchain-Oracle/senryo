"use client";
import type { Caller } from "@senryo/calls";
/**
 * The terminal's ride side (R5.4–R5.5): this market's ride terms on the active network, the leverage held to its
 * cap, the rider's newest open ride here, the live pass (`useLiveRide`) and the flow (`useRideFlow`). Rides are on
 * the 24/7 Pyth crypto (D-299 v1) and live where the reserve is deployed — mainnet's open with S9 (D-305).
 */
import { leverageFor, ridesOn } from "@senryo/calls";
import { type CallFlowEffects, useRideFlow } from "@senryo/calls/react";
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
  const held = useMemo(
    () =>
      "value" in rides
        ? rides.value.rides
            .filter((r) => r.symbol === i.symbol && OPEN.has(r.state))
            .sort((a, b) => (b.rideId > a.rideId ? 1 : -1))[0]
        : undefined,
    [rides, i.symbol],
  );
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
