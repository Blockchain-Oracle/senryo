/** The call flow's knobs (S5, D-280). */

/** A signed call accepts its quote less this (the fill prints a second later; the pool's load surcharge, ≤ 1 %). */
export const TOLERANCE_BPS = 300n;
/** A signed call is good for this long (the relay commits it within seconds). */
export const INTENT_TTL_SEC = 60;
/** A permit for a call's own stake is good for this long. */
export const PERMIT_TTL_SEC = 300;
/** A session this close to expiry signs nothing new: the call would land after it ends. */
export const SESSION_MARGIN_SEC = 30;

/** "Turn on one-tap calls" defaults (the user can change them in Settings): per call, per session, length. */
export const ONE_TAP_DEFAULTS = { perCallUsd: 25, sessionUsd: 100, minutes: 15 } as const;
export const SECONDS_PER_MINUTE = 60;
export const USD = 1_000_000n;

/** Face ID prompts (the OS sheet over the terminal, never a screen swap). */
export const PROMPTS = {
  call: (verb: string, symbol: string) => `${verb} ${symbol}`,
  close: "Cash out",
  oneTap: "Turn on one-tap calls",
  revoke: "Turn off one-tap calls",
} as const;
