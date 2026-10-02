/** Motion for the kit (Part A rule 7): springs for the slide and sheets, a short ease for fades. */
export const SPRING_LAYOUT = { type: "spring", stiffness: 420, damping: 40, mass: 0.6 } as const;
export const SPRING_PRESS = { type: "spring", stiffness: 600, damping: 30 } as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const FADE_S = 0.15;
/** Slide-to-confirm: the share of the track the thumb must cross, and its inner gutter (rem → measured px). */
export const SLIDE_THRESHOLD = 0.82;
export const SLIDE_GUTTER_PX = 8;
/** Label fade points along the slide (share of the travel). */
export const SLIDE_LABEL_FADE = [0, 0.35, 0.65] as const;
/** QR reveal: the particle buckets settle over this long, each a share later than the previous. */
export const QR_REVEAL_S = 0.6;
export const QR_BUCKET_STAGGER = 0.18;
export const SLIDE_LABEL_OPACITY = [1, 0.75, 0] as const;
/** The thumb's arrow morphs into a check across these shares of the travel. */
export const SLIDE_ICON_STOPS = [0, 0.5, 1] as const;
