/**
 * One Activity item per transaction from the movements that touched an address (D8). Amounts are netted per token, so
 * a refund of unused MON cancels its part of the payment and a self-transfer disappears; then one or more tokens out
 * and one or more in is a swap ("Swapped 10 USDC → 0.12 MON"), only in is received, only out is sent — each leg with
 * its counterparty when there is exactly one.
 *  - `internal`: every movement was with a Senryo contract (or in Senryo's own token, the pool share), which the
 *    indexer's event or the phone's journal already tells.
 *  - `spam`: only unverified tokens, and either arriving or "leaving" in a transaction someone else sent (a fake token
 *    can emit a transfer from any address — address poisoning, B14).
 * A token the caller can't name (no metadata: not an ERC-20) is left out; a transaction with nothing left is skipped.
 */
import { NATIVE_TOKEN } from "@senryo/config";
import type { StoredMovement } from "./wallet-store.ts";

export type FoldKind = "received" | "sent" | "swap";

export interface FoldedLeg {
  direction: "in" | "out";
  /** Lower-case token address (`NATIVE_TOKEN` for MON). */
  token: string;
  amount: bigint;
  counterparty: string | null;
}

export interface FoldedTx {
  txHash: string;
  blockNumber: bigint;
  txIndex: number;
  timestamp: number;
  kind: FoldKind;
  legs: FoldedLeg[];
  sender: string | null;
  internal: boolean;
  spam: boolean;
}

export interface FoldContext {
  /** True/false for a named token (verified or not); undefined for a contract that isn't a readable token. */
  verified: (token: string) => boolean | undefined;
  /** Lower-case addresses of Senryo's own contracts on this network. */
  senryo: ReadonlySet<string>;
}

function groups(movements: readonly StoredMovement[]): StoredMovement[][] {
  const byTx = new Map<string, StoredMovement[]>();
  for (const m of movements) {
    const group = byTx.get(m.txHash);
    if (group) group.push(m);
    else byTx.set(m.txHash, [m]);
  }
  return [...byTx.values()];
}

function foldTx(owner: string, group: readonly StoredMovement[], ctx: FoldContext): FoldedTx | undefined {
  const first = group[0];
  if (!first) return undefined;
  const net = new Map<string, bigint>();
  const parties = new Map<string, Set<string>>();
  let internal = true;
  for (const m of group) {
    const incoming = m.to === owner;
    if (incoming === (m.from === owner)) continue;
    const counterparty = incoming ? m.from : m.to;
    if (!ctx.senryo.has(counterparty) && !ctx.senryo.has(m.token)) internal = false;
    net.set(m.token, (net.get(m.token) ?? 0n) + (incoming ? m.value : -m.value));
    const key = `${m.token}:${incoming ? "in" : "out"}`;
    parties.set(key, (parties.get(key) ?? new Set()).add(counterparty));
  }
  const legs: FoldedLeg[] = [];
  for (const [token, amount] of net) {
    if (amount === 0n || ctx.verified(token) === undefined) continue;
    const direction = amount > 0n ? "in" : "out";
    const others = [...(parties.get(`${token}:${direction}`) ?? [])];
    const only = others.length === 1 ? others[0] : undefined;
    legs.push({
      direction,
      token,
      amount: amount > 0n ? amount : -amount,
      counterparty: only && only !== NATIVE_TOKEN ? only : null,
    });
  }
  if (legs.length === 0) return undefined;
  legs.sort(
    (a, b) =>
      Number(a.direction === "in") - Number(b.direction === "in") ||
      Number(ctx.verified(b.token) === true) - Number(ctx.verified(a.token) === true) ||
      a.token.localeCompare(b.token),
  );
  const outs = legs.some((l) => l.direction === "out");
  const ins = legs.some((l) => l.direction === "in");
  const kind: FoldKind = outs && ins ? "swap" : ins ? "received" : "sent";
  const sender = group.find((m) => m.txFrom !== null)?.txFrom ?? null;
  const unverified = legs.every((l) => ctx.verified(l.token) === false);
  return {
    txHash: first.txHash,
    blockNumber: first.blockNumber,
    txIndex: first.txIndex,
    timestamp: first.timestamp,
    kind,
    legs,
    sender,
    internal,
    spam: unverified && (kind === "received" || sender !== owner),
  };
}

/** Movements (newest first, grouped by transaction as the store returns them) → items, newest first. */
export function foldMovements(owner: string, movements: readonly StoredMovement[], ctx: FoldContext): FoldedTx[] {
  const me = owner.toLowerCase();
  return groups(movements).flatMap((group) => foldTx(me, group, ctx) ?? []);
}
