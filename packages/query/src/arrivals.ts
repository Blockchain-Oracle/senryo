/**
 * "Arriving" (flow book B4, B5, B16): money this device started bringing in that hasn't landed yet — a Ramp purchase
 * the user came back from, a bridge into Monad through a deposit address. Each record keeps the wallet balance of the
 * asset when it started; provider evidence is required to settle it; elapsed time marks unresolved. Per network and
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
  providerOperationId?: string;
  providerStatus?: string;
  status?: "created" | "paid" | "processing" | "delivered" | "cancelled" | "unresolved";
  deliveryTransaction?: string;
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
  return {
    ...arrival,
    id: arrival.providerOperationId
      ? `${arrival.kind}:${arrival.chainId}:${arrival.account}:${arrival.providerOperationId}`
      : `${arrival.kind}:${at}`,
    at,
  };
}

/**
 * This account's open provider operations. Only provider status plus destination-transaction evidence
 * settles delivery; overdue records become unresolved and remain stored.
 */
export function openArrivals(
  all: readonly Arrival[],
  chainId: number,
  account: string | undefined,
  assets: readonly Pick<MoneyAsset, "key" | "wallet">[] | undefined,
  nowMs: number,
): { open: Arrival[]; settled: Arrival[] | undefined } {
  // Holdings are only a refresh hint. Dust/internal transfers and elapsed time cannot settle provider money.
  const mine = all.filter((a) => a.chainId === chainId && a.account === account?.toLowerCase());
  const open = mine.filter((a) => a.status !== "cancelled" && !(a.status === "delivered" && a.deliveryTransaction));
  const overdue = open.filter((a) => nowMs - a.at > DAY_MS && a.status !== "unresolved");
  const settled = overdue.length
    ? all.map((a) => (overdue.includes(a) ? { ...a, status: "unresolved" as const } : a))
    : undefined;
  void assets;
  return { open, settled };
}
