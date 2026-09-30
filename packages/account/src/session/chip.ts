/**
 * Session chip state (spec client.md): `● TRADING UNLOCKED · 24:10` / `● LOCKS IN 0:59` / `○ LOCKED · FACE ID TO TRADE`.
 * Pure: the apps render it and tick once a second while unlocked.
 */
import { SECONDS, SESSION_WARN_MS } from "../constants.ts";
import type { SessionSnapshot } from "./manager.ts";

export type ChipTone = "unlocked" | "warning" | "locked" | "none";

export interface ChipState {
  tone: ChipTone;
  label: string;
  /** Remaining ms while unlocked (drives the countdown and the `warn` haptic at the warning edge). */
  remainingMs: number;
}

const SECONDS_PER_MINUTE = 60;
const PAD = 2;

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECONDS));
  const m = Math.floor(total / SECONDS_PER_MINUTE);
  const s = total % SECONDS_PER_MINUTE;
  return `${m}:${String(s).padStart(PAD, "0")}`;
}

/** `unlockWord`: "FACE ID" (iOS), "FINGERPRINT" (Android), "PASSKEY" (web). */
export function chipState(snapshot: SessionSnapshot, now: number, unlockWord: string): ChipState {
  switch (snapshot.status) {
    case "none":
      return { tone: "none", label: "NO ACCOUNT", remainingMs: 0 };
    case "locked":
      return { tone: "locked", label: `LOCKED · ${unlockWord} TO TRADE`, remainingMs: 0 };
    case "unlocked": {
      const remainingMs = Math.max(0, snapshot.expiresAt - now);
      return remainingMs <= SESSION_WARN_MS
        ? { tone: "warning", label: `LOCKS IN ${clock(remainingMs)}`, remainingMs }
        : { tone: "unlocked", label: `TRADING UNLOCKED · ${clock(remainingMs)}`, remainingMs };
    }
  }
}
