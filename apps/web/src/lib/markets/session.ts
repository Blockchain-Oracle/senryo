"use client";

/**
 * Session copy for the engine's onchain status (risk-math.md status matrix) and the oracle age line (D-020 honesty:
 * "Oracle · updated 3m ago"), the same words as the phone. The onchain status decides; the calendar only words when
 * it changes next.
 */
import type { MarketStatus } from "@senryo/core";
import { useEffect, useState } from "react";

export const STATUS_LABEL: Record<MarketStatus, string> = {
  OPEN: "Open",
  REOPENING: "Reopening",
  CLOSED: "Closed",
  STALE: "Price paused",
  CIRCUIT: "Price paused",
  HALTED: "Halted",
};

/** Text colour per status: open in the up ink, halted in the down ink, every other state a warning. */
export function statusTone(status: MarketStatus): string {
  if (status === "OPEN") return "text-up";
  if (status === "HALTED") return "text-down";
  return "text-warn";
}

const SECONDS_PER_MINUTE = 60n;
const SECONDS_PER_HOUR = 3_600n;
const SECONDS_PER_DAY = 86_400n;

/** "just now" / "4m ago" / "2h ago" / "3d ago" from an oracle round time (unix s). */
export function ageLabel(updatedAt: bigint, nowSec: bigint): string {
  const age = nowSec > updatedAt ? nowSec - updatedAt : 0n;
  if (age < SECONDS_PER_MINUTE) return "just now";
  if (age < SECONDS_PER_HOUR) return `${age / SECONDS_PER_MINUTE}m ago`;
  if (age < SECONDS_PER_DAY) return `${age / SECONDS_PER_HOUR}h ago`;
  return `${age / SECONDS_PER_DAY}d ago`;
}

/** Ages are worded in minutes at the finest, so a 15 s tick keeps them true without busy re-renders. */
const AGE_TICK_MS = 15_000;
const MS_PER_SECOND = 1000;

const nowSec = () => BigInt(Math.floor(Date.now() / MS_PER_SECOND));

/**
 * Unix seconds on a timer, so an age line moves even when the oracle is quiet (a closed market would otherwise keep
 * saying "just now"). Zero during the static prerender; the first client render reads the clock.
 */
export function useNowSec(): bigint {
  const [now, setNow] = useState(0n);
  useEffect(() => {
    setNow(nowSec());
    const id = setInterval(() => setNow(nowSec()), AGE_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
