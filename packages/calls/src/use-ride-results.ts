/**
 * Rides' results, joined into `useResults` (R5.11–R5.12): a ride of yours that ends — closed by you, knocked out,
 * capped, or at the end of its life — says what it realised, on the close's own toast when you closed it, with win or
 * loss by that sign. Realised = PnL over every part − the close fees − the open fee (the margin shrinks as parts leave,
 * so it can't be read back). A refused open is the flow's to say; parts closed are the flow's too ("Closed 50%").
 */
import { useRides } from "@senryo/query";
import { useEffect, useRef } from "react";
import { type ResultEffects, realisedCue, signed, usd } from "./result-cue.ts";
import { tradeResulted, tradeToastId } from "./toast-run.ts";

const LIVE = new Set(["committed", "open", "closing"]);

const ENDINGS: Record<string, (where: string, back: string) => { title: string; description: string }> = {
  closed: (where, back) => ({ title: "Realized", description: `Closed ${where} · ${back} back` }),
  knocked_out: (where, back) => ({ title: "Knocked out", description: `${where} hit its knock-out · ${back} back` }),
  capped: (where, back) => ({
    title: "Capped",
    description: `${where} hit its cap, the most it can win · ${back} back`,
  }),
  ended: (where, back) => ({ title: "Ride ended", description: `${where} reached the end of its life · ${back} back` }),
};

export function useRideResults(owner: `0x${string}` | undefined, effects: ResultEffects): void {
  const rides = useRides(owner);
  const seen = useRef(new Map<string, string>());
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  useEffect(() => {
    if (!("value" in rides)) return;
    const fx = effectsRef.current;
    for (const r of rides.value.rides) {
      const key = String(r.rideId);
      const was = seen.current.get(key);
      seen.current.set(key, r.state);
      const ending = ENDINGS[r.state];
      if (was === undefined || !LIVE.has(was) || !ending) continue;
      const net = (r.pnl ?? 0n) - r.fees - r.openFee;
      const words = ending(`${r.isLong ? "Up" : "Down"} ${r.symbol} ride`, usd(r.paid));
      const id = tradeToastId.ride(r.rideId);
      tradeResulted(id);
      realisedCue(fx, net);
      fx.notify({ title: `${words.title} ${signed(net)}`, description: words.description, symbol: r.symbol, id });
    }
  }, [rides]);
}
