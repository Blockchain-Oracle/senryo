/**
 * The terminal's ride flow, both apps (R5.4–R5.5; `useCallFlow`'s twin): what the panel says — ready, a ride in flight
 * ("Signing…", "Opening Up…", "Closing…" until the stream says filled), a stale price, a market that doesn't ride — and
 * the actions with their guards: open Up or Down at the mark within the slippage limit (not enough dollars said with
 * the shortfall), close the held ride for what the tick pass showed, and arm its trail with break-even as the floor.
 * Each tap's toast runs like a call's (R5.11): "Opening Up…" → "Up BTC ride opened"; "Closing…" → its result
 * (`useRideResults`, same id).
 */
import type { IntentStatus, RideView } from "@senryo/api-client";
import { formatUnits, longClockText } from "@senryo/core";
import { useIntentStatus, useRefreshCaller } from "@senryo/query";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import { ridesOn } from "./instrument.ts";
import { forgetIntent } from "./intent-journal.ts";
import { reasonWords } from "./reason-words.ts";
import { tradeToastId } from "./toast-run.ts";
import {
  type CallFlowEffects,
  type FlowPending,
  type OfferSlot,
  type PanelState,
  settleRun,
  WHOLE,
} from "./use-call-flow.ts";
import { usePriceHealth } from "./use-price-health.ts";
import { rideOpenCost, useRideActions } from "./use-ride.ts";
import { useRideExit } from "./use-ride-exit.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SETTLED = new Set(["filled", "refused", "failed"]);
const BPS_PER_X = 10_000;

const usdText = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

/** What the tap reads synchronously: the mark the user saw and, held, the B/E the trail floors at. */
export interface RideLatest {
  markE8: bigint | null;
  breakEvenE8: bigint | null;
}

export interface RideFlowInput {
  symbol: string;
  caller: Caller;
  owner: `0x${string}` | undefined;
  margin: bigint;
  leverageBps: number;
  takerFeeBps: number | undefined;
  balance: bigint | undefined;
  nowSec: number;
  /** The open ride on this market (the newest), if any. */
  held: RideView | undefined;
  latest: RefObject<RideLatest>;
  trailBps: number;
  effects: CallFlowEffects;
}

export function useRideFlow(i: RideFlowInput) {
  const actions = useRideActions(i.caller);
  const exit = useRideExit(i.caller);
  const [signing, setSigning] = useState<string | null>(null);
  const [pending, setPending] = useState<FlowPending | null>(null);
  const intent = useIntentStatus(pending?.digest);
  const status: IntentStatus | null = "value" in intent ? intent.value : null;
  const fx = useRef(i.effects);
  fx.current = i.effects;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const refresh = useRefreshCaller(i.owner);

  useEffect(() => {
    const p = pendingRef.current;
    if (!status || !SETTLED.has(status.state) || !p) return;
    refresh();
    forgetIntent(p.digest);
    settleRun(fx.current, p, status, {
      symbol: i.symbol,
      refused: p.kind === "close" ? "Close refused" : "Ride refused",
      failed: p.kind === "close" ? "Close didn't go through" : "Ride didn't go through",
      kept: p.kind === "close" ? "It's still open." : "Your margin was not taken.",
    });
    setPending(null);
  }, [status, refresh, i.symbol]);

  const health = usePriceHealth(i.symbol);
  const held = i.held && i.held.state !== "committed" ? i.held : undefined;
  const panel: PanelState = pending
    ? { kind: "pending", status, label: pending.label }
    : signing
      ? { kind: "pending", status: null, label: signing }
      : !ridesOn(i.symbol)
        ? { kind: "locked", text: `Rides aren't available on ${i.symbol}` }
        : !health.live
          ? { kind: "stale", text: health.notice ?? "Price paused" }
          : i.held?.state === "closing"
            ? { kind: "pending", status: null, label: "Closing at the next price…" }
            : { kind: "ready" };

  const guard = (slot?: OfferSlot): boolean => {
    if (!i.owner) {
      fx.current.needAccount(slot);
      return false;
    }
    if (fx.current.gate && !fx.current.gate()) return false;
    return actions.ready;
  };

  const open = async (slot: OfferSlot) => {
    if (!guard(slot)) return;
    const mark = i.latest.current?.markE8;
    if (mark == null || i.takerFeeBps === undefined) {
      fx.current.notify({ title: "No live price", description: "Rides open on a live price. Try again in a moment." });
      return;
    }
    const cost = rideOpenCost(i.margin, i.leverageBps, i.takerFeeBps);
    if (i.balance !== undefined && i.balance < cost) {
      const short = cost - i.balance;
      if (fx.current.shortfall) fx.current.shortfall(short);
      else
        fx.current.notify({
          title: "Not enough dollars",
          description: `This ride takes $${formatUnits(cost, DOLLAR_DECIMALS, CENTS)} with its fee.`,
        });
      return;
    }
    const isLong = slot === 0;
    const side = isLong ? "Up" : "Down";
    const terms = `${usdText(i.margin)} at ${i.leverageBps / BPS_PER_X}×`;
    fx.current.cue("press");
    const id = tradeToastId.open();
    fx.current.toast(id, {
      title: `Opening ${side}…`,
      description: `${i.symbol} ride · ${terms}`,
      symbol: i.symbol,
      tone: "loading",
    });
    setSigning("Signing…");
    try {
      const r = await actions.open({
        symbol: i.symbol,
        isLong,
        margin: i.margin,
        leverageBps: i.leverageBps,
        markE8: mark,
        journal: { what: `${side} ${i.symbol} ride`, kind: "open", instrument: "ride", symbol: i.symbol, toast: id },
      });
      if (r.kind === "cancelled") fx.current.toast(id, null);
      // A lost answer is recovery's to tell, on this same toast (R5.13).
      else if (r.kind === "sent")
        setPending({
          digest: r.status.digest,
          label: `Opening ${side}…`,
          kind: "open",
          toast: id,
          filled: { title: `${side} ${i.symbol} ride opened`, description: terms, symbol: i.symbol, tone: "info" },
          cue: "filled-open",
        });
    } catch (error) {
      fx.current.cue("fail");
      fx.current.toast(id, {
        title: "Couldn't open the ride",
        description: reasonWords((error as Error).message, "Your margin was not taken."),
        symbol: i.symbol,
        tone: "warning",
      });
    } finally {
      setSigning(null);
    }
  };

  /** Close the held ride, or `percent` of it. */
  const close = async (percent: bigint = WHOLE) => {
    const mark = i.latest.current?.markE8;
    if (!guard() || !held || mark == null) return;
    fx.current.cue("press");
    const whole = percent === WHOLE;
    const label = whole ? "Closing…" : `Closing ${percent}%…`;
    const id = tradeToastId.ride(held.rideId);
    fx.current.toast(id, { title: label, symbol: i.symbol, tone: "loading" });
    setSigning("Signing…");
    try {
      const size = whole ? 0n : (held.size * percent) / WHOLE;
      const r = await actions.close({
        rideId: held.rideId,
        symbol: i.symbol,
        isLong: held.isLong,
        markE8: mark,
        size,
        journal: {
          what: `${held.isLong ? "Up" : "Down"} ${i.symbol} ride`,
          kind: "close",
          instrument: "ride",
          symbol: i.symbol,
          toast: id,
        },
      });
      if (r.kind === "cancelled") fx.current.toast(id, null);
      else if (r.kind === "sent")
        setPending({
          digest: r.status.digest,
          label,
          kind: "close",
          toast: id,
          filled: {
            title: whole ? "Closed" : `Closed ${percent}%`,
            description: whole ? "Counting it up…" : "The rest rides on.",
            symbol: i.symbol,
            tone: "info",
          },
          cue: whole ? null : "filled-close",
        });
    } catch (error) {
      fx.current.cue("fail");
      fx.current.toast(id, {
        title: "Couldn't close the ride",
        description: reasonWords((error as Error).message, "It's still open."),
        symbol: i.symbol,
        tone: "warning",
      });
    } finally {
      setSigning(null);
    }
  };

  /** Arm the trail at `trailBps`, flooring at break-even and keeping any take-profit and stop already set. */
  const armTrail = async (): Promise<boolean> => {
    const be = i.latest.current?.breakEvenE8;
    if (!guard() || !held || be == null) return false;
    fx.current.cue("press");
    try {
      const r = await exit.set(held.rideId, {
        takeProfitE8: held.exit?.takeProfitE8 ?? 0n,
        stopLossE8: held.exit?.stopLossE8 ?? 0n,
        floorE8: be,
        trailBps: i.trailBps,
      });
      return r.kind === "sent";
    } catch (error) {
      fx.current.cue("fail");
      fx.current.notify({ title: "Couldn't arm the trail", description: (error as Error).message });
      return false;
    }
  };

  const endsIn = held?.endAt ? `Closes in ${longClockText(held.endAt - i.nowSec)}` : null;
  return { panel, holding: held !== undefined, open, close, armTrail, setExit: exit.set, arming: exit.pending, endsIn };
}
