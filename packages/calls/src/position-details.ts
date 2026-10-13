/**
 * Position details (D-343, Codex direction 15 §4): the facts the row no longer carries, as plain key/value rows behind
 * one menu item — a ride's entry, knock-out, cap, margin, fees and when it closes; a call's entry, its line (or range
 * edges, or strike), stake, what it pays if right, fees and when it settles. Values, not sentences (D-345): prices E8,
 * money bigint (the apps mask it), times unix seconds.
 */
import { bandMenu, MARKETS } from "@senryo/config";
import { bandEdgesE8 } from "@senryo/core";
import type { BookEntry } from "./book.ts";

const MS = 1_000;

export type DetailValue =
  | { kind: "price"; e8: bigint | null }
  | { kind: "money"; v: bigint | null }
  | { kind: "time"; at: number | null };

export interface PositionDetail {
  label: string;
  value: DetailValue;
}

const price = (label: string, e8: bigint | null | undefined): PositionDetail => ({
  label,
  value: { kind: "price", e8: e8 ?? null },
});
const money = (label: string, v: bigint | null | undefined): PositionDetail => ({
  label,
  value: { kind: "money", v: v ?? null },
});

/** A call's line, or its range's edges, or its strike — by the band it was placed on. */
function callLevels(e: BookEntry): PositionDetail[] {
  const call = e.call;
  if (!call) return [];
  const market = MARKETS.find((m) => m.symbol === e.symbol);
  const spec = market ? bandMenu(market, call.cadenceSec)[call.band] : undefined;
  if (!spec || call.lineE8 === null || spec.kind === "up" || spec.kind === "down") return [price("Line", call.lineE8)];
  const edges = bandEdgesE8(spec, call.lineE8);
  if (spec.kind === "range") return [price("Range low", edges.low), price("Range high", edges.high)];
  return [price("Strike", spec.kind === "moonshot" ? edges.low : edges.high)];
}

export function positionDetails(e: BookEntry): PositionDetail[] {
  const ends: PositionDetail = {
    label: e.kind === "ride" ? "Closes at" : "Settles at",
    value: { kind: "time", at: e.endsAt },
  };
  if (e.kind === "ride") {
    return [
      price("Entry", e.entryE8),
      price("Knock-out price", e.ride?.koE8),
      price("Cap price", e.ride?.capE8),
      money("Margin", e.cost),
      money("Fees", e.fees),
      ends,
    ];
  }
  return [
    price("Entry", e.entryE8),
    ...callLevels(e),
    money("Stake", e.cost),
    money("Pays if right", e.call?.shares),
    money("Fees", e.fees),
    ends,
  ];
}

/** "13 Oct, 14:05": a detail's full local time. */
export const datedText = (unixSec: number): string =>
  new Date(unixSec * MS).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
