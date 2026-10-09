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
  exit: "Set the exit",
  parlay: (legs: number) => `Parlay of ${legs}`,
  duel: "Enter the duel",
  duelPick: "Your duel pick",
  event: (side: string) => `Call ${side}`,
  clearExit: "Remove the exit",
  oneTap: "Turn on one-tap calls",
  revoke: "Turn off one-tap calls",
} as const;

/** Exits (S8.4, D-292): one cent a share as a bid × 1e6; the trail's distances offered and its longest (cents a share). */
export const CENT_E6 = 10_000;
export const TRAIL_CENTS = [5, 10, 20] as const;
export const TRAIL_MAX_CENTS = 50;
/** Take-profit and stop presets as multiples of today's value (bps). */
export const TAKE_PROFIT_STEPS_BPS = [12_500n, 15_000n, 20_000n] as const;
export const STOP_STEPS_BPS = [7_500n, 5_000n, 2_500n] as const;
/** The exit stepper's step (cents) for a value this size: 5¢ under $50, 25¢ under $250, else $1. */
export const EXIT_STEP_CENTS: readonly (readonly [underCents: number, stepCents: number])[] = [
  [5_000, 5],
  [25_000, 25],
];
export const EXIT_DOLLAR_STEP_CENTS = 100;
/** "Never below" starts at half of today's value (bps). */
export const FLOOR_START_BPS = 5_000n;

/** The parlay slip's stake presets, in dollars (S8.5). */
export const PARLAY_STAKES_USD = [1, 5, 10, 25] as const;
