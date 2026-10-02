/**
 * Shell constants (S1b.7, D-176/D-193): the five dock destinations in dock order, the Phantom fan's four actions, and
 * the material strengths the tokens leave to the renderer. Geometry and motion live in the theme (DOCK, FAN, SPRING,
 * TIMING); these are shell choices only.
 */

/** Dock order (C15, direction §5): Home · Markets · Card · Social · You. Route names = the `(tabs)` folders. */
export const TABS = ["home", "markets", "card", "social", "you"] as const;
export type TabName = (typeof TABS)[number];

export const TAB_LABEL: Record<TabName, string> = {
  home: "Home",
  markets: "Markets",
  card: "Card",
  social: "Social",
  you: "Profile",
};

/** Each tab's root path (expo-router strips the `(tabs)` group from URLs). */
export const TAB_HREF = {
  home: "/home",
  markets: "/markets",
  card: "/card",
  social: "/social",
  you: "/you",
} as const satisfies Record<TabName, string>;

/** Phantom fan order, top to bottom (C18/P19): Send leads; "Swap" replaces Phantom's ambiguous "Trade" (direction §5). */
export const FAN_ACTIONS = ["send", "receive", "addMoney", "swap"] as const;
export type FanAction = (typeof FAN_ACTIONS)[number];

export const FAN_LABEL: Record<FanAction, string> = {
  send: "Send",
  receive: "Receive",
  addMoney: "Add money",
  swap: "Swap",
};

/**
 * Material strengths (expo-blur intensity 0–100). The dock's blur only stands in for Liquid Glass before iOS 26; the
 * fan's backdrop is the "strong live blur" of P19/M06 — the page underneath stays recognisable only as colour fields.
 */
export const DOCK_BLUR_INTENSITY = 60;
export const FAN_BLUR_INTENSITY = 90;

/** The fan items start this far below their slot and this small (M06 onset: rise + scale from the plus). */
export const FAN_ITEM_RISE = 24;
export const FAN_ITEM_FROM_SCALE = 0.6;
/** A dock icon shrinks to this under the finger. */
export const DOCK_PRESS_SCALE = 0.88;
/** The collapsed header's compact balance fades in over the last part of the collapse (fraction of the distance). */
export const HEADER_COMPACT_FROM = 0.55;
/** The expanded header content fades out over the first part of the collapse. */
export const HEADER_EXPANDED_UNTIL = 0.6;
/** A scroll event at most every frame. */
export const SCROLL_THROTTLE_MS = 16;
