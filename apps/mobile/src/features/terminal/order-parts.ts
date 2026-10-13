/**
 * The order sheet's shared parts (Q1): the keypad's typed amount with its problem said as it's typed (only a valid
 * amount kept), and the money presets — used by the ride and the call settings alike.
 */
import { dollars } from "@senryo/calls";
import { useState } from "react";

const USD = 1_000_000n;

export const chipsOf = (presets: readonly number[], max: bigint, available: bigint | undefined) => [
  ...presets.filter((d) => BigInt(d) * USD <= max).map((d) => ({ label: `$${d}`, value: BigInt(d) * USD })),
  ...(available !== undefined && available > 0n ? [{ label: "Max", value: available < max ? available : max }] : []),
];

const problemOf = (v: bigint, min: bigint, max: bigint, available: bigint | undefined): string | null =>
  v === 0n
    ? null
    : v < min
      ? `At least ${dollars(min)}`
      : available !== undefined && v > available
        ? `You have ${dollars(available)}`
        : v > max
          ? `At most ${dollars(max)}`
          : null;

/** What's typed on the keypad, its problem said as it's typed, and only a valid amount kept. */
export function useTyped(
  value: bigint,
  min: bigint,
  max: bigint,
  available: bigint | undefined,
  keep: (v: bigint) => void,
) {
  const [typed, setTyped] = useState(value);
  const problem = problemOf(typed, min, max, available);
  const change = (v: bigint) => {
    setTyped(v);
    if (v > 0n && !problemOf(v, min, max, available)) keep(v);
  };
  return { typed, problem, change };
}
