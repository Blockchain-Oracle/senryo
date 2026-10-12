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

/** A ride's trail distance in bps of the price (Tradash: 0.10 % default; 0.10 / 0.50 / 1.00 / 2.00 % offered). */
export const RIDE_TRAIL_BPS = 10;
export const RIDE_TRAIL_STEPS_BPS = [10, 50, 100, 200] as const;
/** A ride's margin presets (dollars) and the leverage chips offered, capped at the market's own maximum. */
export const RIDE_MARGIN_USD = [5, 10, 25, 50] as const;
export const RIDE_LEVERAGE_CHIPS = [2, 5, 10, 20, 40] as const;
export const PROMPT_RIDE_EXIT = "Set the ride's exit";
/** A ride exit's take-profit and stop steps from the entry, in bps of the price (0.5 / 1 / 2 / 5 %). */
export const RIDE_EXIT_MOVES_BPS = [50, 100, 200, 500] as const;
/** The size slider's marks: none, a quarter, half, three quarters and all of what's available. */
export const SIZE_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

const THIN = 1;
const TRAIL_W = 1.5;
/** How each chart level is drawn (`levels.ts` LEVEL_STYLE): dash, strength, width and colour role (R5.6). */
export const LEVEL_TABLE = {
  line: { dash: [2, 3], alpha: 0.7, width: THIN, role: "ink" },
  entry: { dash: [4, 4], alpha: 0.55, width: THIN, role: "helper" },
  edge: { dash: [8, 4], alpha: 0.6, width: THIN, role: "helper" },
  be: { dash: [1, 3], alpha: 0.9, width: THIN, role: "warn" },
  trail: { dash: [6, 3], alpha: 1, width: TRAIL_W, role: "tone" },
  tp: { dash: [5, 3], alpha: 0.8, width: THIN, role: "up" },
  sl: { dash: [5, 3], alpha: 0.8, width: THIN, role: "down" },
  ko: { dash: [2, 3], alpha: 0.9, width: THIN, role: "down" },
  cap: { dash: [5, 3], alpha: 0.7, width: THIN, role: "up" },
} as const;
/** The PnL band's strength at the price side and at the entry (Tradash: 0.22 → 0.02). */
export const BAND_ALPHA = { far: 0.22, near: 0.02 } as const;
