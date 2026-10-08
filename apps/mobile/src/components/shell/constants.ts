/**
 * Shell constants (S1b.7, D-176/D-193): the dock destinations in dock order, the contextual money sheet's actions, and
 * the material strengths the tokens leave to the renderer. Geometry and motion live in the theme (DOCK, SPRING,
 * TIMING); these are shell choices only.
 */

import { DOCK_NAV, type DockKey } from "@senryo/config";

/**
 * Dock destinations from the shared navigation source (D-268): Home · Markets · [seal = Trade] · Calls · More. Route
 * names are the `(tabs)` folders, which match the dock keys.
 */
export const TABS: readonly DockKey[] = DOCK_NAV.map((item) => item.key);
export type TabName = DockKey;

/** The collapsed header's compact balance fades in over the last part of the collapse (fraction of the distance). */
export const HEADER_COMPACT_FROM = 0.55;
/** The expanded header content fades out over the first part of the collapse. */
export const HEADER_EXPANDED_UNTIL = 0.6;
/** A scroll event at most every frame. */
export const SCROLL_THROTTLE_MS = 16;
