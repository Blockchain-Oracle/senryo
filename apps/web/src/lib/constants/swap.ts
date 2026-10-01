/** Motion + formatting constants for the BeUI Multi-chain Swap port (D2: fast, no bounce). */

/** D2 "nothing bounces": critically damped springs only. */
export const SWAP_SPRING = { type: "spring", stiffness: 460, damping: 44, mass: 0.55 } as const;
export const SWAP_PANEL_SPRING = { type: "spring", stiffness: 420, damping: 42, mass: 0.5 } as const;

/** Drawer ease (Vaul/iOS sheet curve) and durations in seconds. */
export const SWAP_DRAWER_EASE = [0.32, 0.72, 0, 1] as const;
export const SWAP_DRAWER_S = 0.32;
export const SWAP_DRAWER_REDUCED_S = 0.12;

/** Simulated quote refresh while inputs settle (the real quote comes from the Aurora client in S8). */
export const SWAP_QUOTE_DEBOUNCE_MS = 450;

/** Token mark edge in the picker and field (px): a ≥ 32 px disc (Circle's USDC minimum, v2-plan §5.12). */
export const TOKEN_MARK_SIZE = 32;
export const SWAP_FLIP_DEG = 180;

/** Display-only amount formatting thresholds. */
export const DISPLAY_TINY = 0.0001;
export const DISPLAY_UNIT = 1;
export const DISPLAY_THOUSAND = 1000;
export const DISPLAY_SMALL_DIGITS = 4;
export const DISPLAY_LARGE_DIGITS = 2;
export const USD_DIGITS = 2;
