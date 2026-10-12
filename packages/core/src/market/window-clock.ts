/**
 * A window's clock in words, on the server's seconds (both apps' lanes, Markets rows and ⌘K): "1m" / "1h" for a
 * cadence, "0:42" for a count, and where a window stands — calls open until expiry − the lockout (`LOCKOUT_SEC` in
 * `@senryo/config`, D-261), then the next window's calls open at the boundary.
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const PAD = 2;

/** `60` → "1m", `3600` → "1h". */
export const laneLabel = (cadence: number): string =>
  cadence >= SECONDS_PER_HOUR ? `${cadence / SECONDS_PER_HOUR}h` : `${cadence / SECONDS_PER_MINUTE}m`;

/** `42` → "0:42", `125` → "2:05". */
export const clockText = (sec: number): string =>
  `${Math.floor(sec / SECONDS_PER_MINUTE)}:${String(Math.max(0, sec % SECONDS_PER_MINUTE)).padStart(PAD, "0")}`;

/** `13338` → "3:42:18" (hours once there are any, else "m:ss"): a ride's life left. */
export const longClockText = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  if (s < SECONDS_PER_HOUR) return clockText(s);
  const h = Math.floor(s / SECONDS_PER_HOUR);
  const rest = s % SECONDS_PER_HOUR;
  const m = String(Math.floor(rest / SECONDS_PER_MINUTE)).padStart(PAD, "0");
  return `${h}:${m}:${String(rest % SECONDS_PER_MINUTE).padStart(PAD, "0")}`;
};

export interface WindowCountdown {
  /** Calls are open in the current window. */
  open: boolean;
  /** Seconds until calls close (≤ 0 once closed). */
  closesIn: number;
  /** Seconds until the window ends and the next one's calls open. */
  endsIn: number;
}

export function windowCountdown(nowSec: number, cadence: number, lockoutSec: number): WindowCountdown {
  const endsIn = cadence - (nowSec % cadence);
  const closesIn = endsIn - lockoutSec;
  return { open: closesIn > 0, closesIn, endsIn };
}
