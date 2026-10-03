/**
 * "Arriving" (flow book B4, B5, B16): money this device started bringing in that hasn't landed yet — a Ramp purchase
 * the user came back from, a bridge into Monad through a deposit address. Each record keeps the wallet balance of the
 * asset when it started; once the balance is above it (or a day has passed) the record clears. Per network and
 * account. The platform-free half shared by the phone and the web; each app keeps the list in its own storage.
 */
import type { MoneyAsset } from "./money-assets.ts";

const DAY_MS = 86_400_000;

export interface Arrival {
  id: string;
  kind: "ramp" | "bridge";
  chainId: number;
  account: string;
  /** Lower-case token address on Monad. */
  asset: string;
  symbol: string;
  /** Raw wallet balance when it started. */
  baseline: string;
  /** Expected raw amount, when known (a bridge quote). */
  amount?: string | undefined;
  /** "Ramp", "Base". */
  via: string;
  at: number;
}

/** The stored list, tolerant of a missing or damaged value. */
export function parseArrivals(raw: string | null | undefined): Arrival[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as Arrival[]) : [];
  } catch {
    return [];
  }
}

/** A new record, stamped now. */
export function arrivalOf(arrival: Omit<Arrival, "id" | "at">, at: number): Arrival {
  return { ...arrival, id: `${arrival.kind}:${at}`, at };
}

/**
 * This account's open arrivals, and the list to store when some have landed (their asset's wallet balance rose above
 * the baseline, or a day passed) — undefined when nothing changed or the holdings aren't read yet.
 */
export function openArrivals(
  all: readonly Arrival[],
  chainId: number,
  account: string | undefined,
  assets: readonly Pick<MoneyAsset, "key" | "wallet">[] | undefined,
  nowMs: number,
): { open: Arrival[]; settled: Arrival[] | undefined } {
  const landed = (a: Arrival) => {
    if (nowMs - a.at > DAY_MS) return true;
    const held = assets?.find((x) => x.key === a.asset);
    return held !== undefined && held.wallet > BigInt(a.baseline);
  };
  const mine = all.filter((a) => a.chainId === chainId && a.account === account?.toLowerCase());
  const open = mine.filter((a) => !landed(a));
  const settled =
    assets && open.length !== mine.length ? all.filter((a) => !mine.includes(a) || open.includes(a)) : undefined;
  return { open, settled };
}
