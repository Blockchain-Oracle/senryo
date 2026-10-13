"use client";
/**
 * The one round clock above a list of markets (D-348; the phone's `RoundClock`): the 1-minute window every market
 * shares, as a small ring and "1m closes in 0:42" (or "reopens in 0:19" in the lockout), on the server's clock — so
 * no row repeats it.
 */
import { useRoundClock } from "@senryo/calls/react";
import { CountdownRing } from "@/features/terminal/CountdownRing";

export function RoundClock() {
  const clock = useRoundClock();
  return (
    <span role="timer" className="inline-flex items-center gap-1.5 text-meta text-text-3 tabular-nums">
      <CountdownRing fromSec={clock.fromSec} toSec={clock.toSec} nowSec={clock.nowSec} />
      {clock.label} {clock.text}
    </span>
  );
}
