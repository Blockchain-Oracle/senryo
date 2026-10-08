/**
 * Shell constants (S1b.7, D-176/D-193): the dock destinations in dock order, the contextual money sheet's actions, and
 * the material strengths the tokens leave to the renderer. Geometry and motion live in the theme (DOCK, SPRING,
 * TIMING); these are shell choices only.
 */

/**
 * Dock destinations after the pivot (D-256). S5 replaces this with the shared navigation source (D-268):
 * Home · Markets · [seal = Trade] · Calls · More. Route names = the `(tabs)` folders.
 */
export const TABS = ["home", "markets", "you"] as const;
export type TabName = (typeof TABS)[number];

export const TAB_LABEL: Record<TabName, string> = {
  home: "Home",
  markets: "Markets",
  you: "Profile",
};

/** Each tab's root path (expo-router strips the `(tabs)` group from URLs). */
export const TAB_HREF = {
  home: "/home",
  markets: "/markets",
  you: "/you",
} as const satisfies Record<TabName, string>;

/** Money fan actions; Add money (test dollars, Aurora any-chain) and Withdraw join in S5 (D-266). */
export const FAN_ACTIONS = ["receive"] as const;
export type FanAction = (typeof FAN_ACTIONS)[number];

export const FAN_LABEL: Record<FanAction, string> = {
  receive: "Receive",
};

/** The collapsed header's compact balance fades in over the last part of the collapse (fraction of the distance). */
export const HEADER_COMPACT_FROM = 0.55;
/** The expanded header content fades out over the first part of the collapse. */
export const HEADER_EXPANDED_UNTIL = 0.6;
/** A scroll event at most every frame. */
export const SCROLL_THROTTLE_MS = 16;
