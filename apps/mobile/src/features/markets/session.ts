/**
 * Session copy for the engine's onchain status (risk-math.md status matrix) and the oracle age line (D-020 honesty:
 * "Oracle price · updated 3m ago"). The onchain status decides; the calendar only words when it reopens.
 */
import type { MarketStatus } from "@senryo/core";
import type { Palette } from "~/theme/palette";

export const STATUS_LABEL: Record<MarketStatus, string> = {
  OPEN: "Open",
  REOPENING: "Reopening",
  CLOSED: "Closed",
  STALE: "Price paused",
  CIRCUIT: "Price paused",
  HALTED: "Halted",
};

/** Short chip text for the session badge. */
export const STATUS_CHIP: Record<MarketStatus, string> = {
  OPEN: "OPEN",
  REOPENING: "REOPENING",
  CLOSED: "CLOSED",
  STALE: "PAUSED",
  CIRCUIT: "PAUSED",
  HALTED: "HALTED",
};

export function statusTone(status: MarketStatus, color: Palette): string {
  if (status === "OPEN") return color.up;
  if (status === "HALTED") return color.down;
  return color.warn;
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
