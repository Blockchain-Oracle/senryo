/**
 * "Living Lacquer" type, space, radius, elevation and motion scales (direction §3–4, v2-plan §5.3–5.4; every value not
 * in the direction is from the S1b.6 Codex consult, docs/design/senryo-v2/tokens-consult.md, D-191). Inter 400–700 for UI,
 * Inter Display SemiBold for big numbers and titles ≥ 32, Noto Sans JP for Japanese, tabular lining figures for money,
 * sentence/title case with no tracked uppercase. Exact source fonts and springs are declared adaptations.
 */

export const FONT = {
  sans: "Inter",
  display: "Inter Display",
  jp: "Noto Sans JP",
  /** Legacy alias: amounts used a monospace face in D2; they are now Inter with tabular lining figures. */
  mono: "Inter",
} as const;

/** `display` roles use Inter Display; `numeric` roles turn on tabular + lining figures (`tnum`, `lnum`). */
export type TypeFace = "sans" | "display";
interface TypeSpec {
  size: number;
  lineHeight: number;
  /** em; display sizes track −0.02 em. */
  tracking: number;
  weight: 400 | 500 | 600 | 700;
  font: TypeFace;
  numeric: boolean;
}

const DISPLAY_TRACKING = -0.02;

/** Font sizes in px (web converts to rem at 16 px; mobile uses points). */
export const TYPE = {
  // Existing role names (step 1), kept for the screens that read them.
  micro: { size: 12, lineHeight: 16, tracking: 0, weight: 500, font: "sans", numeric: false },
  label: { size: 12, lineHeight: 16, tracking: 0, weight: 600, font: "sans", numeric: false },
  caption: { size: 12, lineHeight: 16, tracking: 0, weight: 400, font: "sans", numeric: false },
  body: { size: 16, lineHeight: 22, tracking: 0, weight: 400, font: "sans", numeric: false },
  bodyStrong: { size: 16, lineHeight: 22, tracking: 0, weight: 600, font: "sans", numeric: false },
  title: { size: 20, lineHeight: 24, tracking: 0, weight: 600, font: "sans", numeric: false },
  numSm: { size: 16, lineHeight: 20, tracking: 0, weight: 500, font: "sans", numeric: true },
  numMd: { size: 20, lineHeight: 24, tracking: 0, weight: 600, font: "sans", numeric: true },
  numTicker: { size: 40, lineHeight: 44, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  numLg: { size: 40, lineHeight: 44, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  numXl: { size: 52, lineHeight: 56, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  numHero: { size: 52, lineHeight: 56, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  // Living Lacquer roles (step 2): home balance, ticket margin, market price; rows, meta, titles, controls.
  displayBalance: { size: 52, lineHeight: 56, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  displayMargin: { size: 64, lineHeight: 68, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  displayPrice: { size: 40, lineHeight: 44, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: true },
  pageTitle: { size: 32, lineHeight: 38, tracking: DISPLAY_TRACKING, weight: 600, font: "display", numeric: false },
  sheetTitle: { size: 24, lineHeight: 28, tracking: 0, weight: 600, font: "sans", numeric: false },
  /** A full-page step's title (Fomo F04/F06 "Create your username"): between the sheet title and the page title. */
  stepTitle: { size: 28, lineHeight: 34, tracking: DISPLAY_TRACKING, weight: 600, font: "sans", numeric: false },
  /** Text typed into a field, and its placeholder (F04). */
  field: { size: 17, lineHeight: 22, tracking: 0, weight: 500, font: "sans", numeric: false },
  sectionTitle: { size: 20, lineHeight: 24, tracking: 0, weight: 600, font: "sans", numeric: false },
  row: { size: 16, lineHeight: 20, tracking: 0, weight: 500, font: "sans", numeric: false },
  rowStrong: { size: 16, lineHeight: 20, tracking: 0, weight: 600, font: "sans", numeric: false },
  rowAmount: { size: 16, lineHeight: 20, tracking: 0, weight: 600, font: "sans", numeric: true },
  /** A market or selector row's first line and its price (Fomo F09/F12: symbol and price carry equal weight). */
  rowTitle: { size: 17, lineHeight: 22, tracking: 0, weight: 600, font: "sans", numeric: false },
  rowPrice: { size: 17, lineHeight: 22, tracking: 0, weight: 600, font: "sans", numeric: true },
  rowChange: { size: 14, lineHeight: 18, tracking: 0, weight: 500, font: "sans", numeric: true },
  /** The second line of a rich row (Fomo F20: "Receive USDC from a crypto wallet"). */
  rowDetail: { size: 14, lineHeight: 18, tracking: 0, weight: 400, font: "sans", numeric: false },
  meta: { size: 12, lineHeight: 16, tracking: 0, weight: 400, font: "sans", numeric: false },
  moneyMeta: { size: 12, lineHeight: 16, tracking: 0, weight: 500, font: "sans", numeric: true },
  buttonLabel: { size: 17, lineHeight: 22, tracking: 0, weight: 600, font: "sans", numeric: false },
  buttonCompact: { size: 15, lineHeight: 20, tracking: 0, weight: 600, font: "sans", numeric: false },
  tabLabel: { size: 12, lineHeight: 16, tracking: 0, weight: 600, font: "sans", numeric: false },
  chipLabel: { size: 12, lineHeight: 16, tracking: 0, weight: 500, font: "sans", numeric: false },
  modeLabel: { size: 13, lineHeight: 18, tracking: 0, weight: 600, font: "sans", numeric: false },
  chipCategory: { size: 14, lineHeight: 18, tracking: 0, weight: 600, font: "sans", numeric: false },
  sheetHeading: { size: 22, lineHeight: 28, tracking: 0, weight: 600, font: "sans", numeric: false },
  fanLabel: { size: 24, lineHeight: 28, tracking: 0, weight: 600, font: "sans", numeric: false },
} as const satisfies Record<string, TypeSpec>;
export type TypeRole = keyof typeof TYPE;

/** Inter Display takes over from Inter at this size (px/pt, inclusive). */
export const DISPLAY_MIN_SIZE = 32;

/** Spacing in px on a 4 px grid (2 is an optical micro-gap only); `inset` is the default screen gutter. */
export const SPACE = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  lgPlus: 20,
  inset: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Radius 8 / 12 / 16 / 24 / 32 / pill: chips · inputs · action rows · cards and sheet tops · onboarding hero · buttons,
 * dock, fan and avatars. `sm` (12) is also the compatibility corner for components not rebuilt yet.
 */
export const RADIUS = { none: 0, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;
/** Ordinary divider/border stroke. */
export const HAIRLINE_PX = 1;

/** Shadows: only the dock and sheets are elevated; raised content surfaces carry none (direction §3). */
export const ELEVATION = {
  /** The filled primary button sits a hair above the page (Fomo F09's Deposit). */
  button: { x: 0, y: 2, blur: 4, spread: 0, color: "#00000029" },
  dock: { x: 0, y: 8, blur: 24, spread: 0, color: "#00000033" },
  sheet: { x: 0, y: -4, blur: 16, spread: 0, color: "#0000001F" },
} as const;

/** A physics spring: mass / stiffness / damping; `overshoot` false → `overshootClamping`. */
export interface SpringSpec {
  mass: number;
  stiffness: number;
  damping: number;
  overshoot: boolean;
}

/** Motion families (direction §4). Millisecond values beside springs are choreography targets, not spring inputs. */
export const SPRING = {
  compactSelector: { mass: 1, stiffness: 260, damping: 30, overshoot: false },
  tallDetail: { mass: 1, stiffness: 240, damping: 30, overshoot: false },
  /** Send's translation keeps its small overshoot; every other fan item and all scale springs clamp. */
  fanLead: { mass: 1, stiffness: 420, damping: 30, overshoot: true },
  fan: { mass: 1, stiffness: 420, damping: 30, overshoot: false },
  dockActive: { mass: 1, stiffness: 500, damping: 36, overshoot: false },
  rulerSnap: { mass: 1, stiffness: 500, damping: 40, overshoot: false },
  /** A released drag returns to rest, carrying the finger's velocity (sheets; a hair of overshoot reads as weight). */
  sheetRelease: { mass: 1, stiffness: 320, damping: 32, overshoot: true },
  /** The dock's active bubble: quick, with the small overshoot that makes it read as liquid (M10). */
  dockBubble: { mass: 1, stiffness: 420, damping: 30, overshoot: true },
} as const satisfies Record<string, SpringSpec>;

/** Common spring rest threshold (Reanimated 4 `energyThreshold`). */
export const SPRING_ENERGY_THRESHOLD = 6e-9;

/** Motion (ms) on `cubic-bezier(0.2, 0.8, 0.2, 1)`. `fastMs`/`baseMs`/`slowMs`/`flash*` are the step-1 names. */
export const MOTION = {
  pressMs: 100,
  selectionMs: 170,
  pagePushMs: 320,
  compactSelectorMs: 420,
  tallDetailMs: 450,
  parentChildMs: 600,
  fanItemMs: 200,
  fanStaggerMs: 25,
  fanBackdropMs: 160,
  fanToggleMs: 180,
  fanToggleDeg: 45,
  fanExitMs: 180,
  fanExitItemMs: 135,
  fanExitStaggerMs: 15,
  dockActiveMs: 260,
  headerCollapseDistance: 132,
  numberChangeMs: 160,
  chartRevealMs: 750,
  onboardingSceneMs: 850,
  qrRevealMs: 650,
  ambientLoopMs: 8000,
  completionFoilMs: 800,
  reducedMotionMs: 100,
  /** Press: down in `pressMs`, back in `pressReleaseMs` — the control answers the finger before anything else moves. */
  pressScale: 0.97,
  pressReleaseMs: 160,
  /**
   * Sheets rise on the iOS drawer curve (M02/M12: major rise ≈ 0.4–0.5 s, fast start, long settle) and leave faster
   * than they came. Their content follows in a short stagger.
   */
  sheetEnterMs: 480,
  sheetExitMs: 240,
  sheetEasing: [0.32, 0.72, 0, 1] as const,
  staggerMs: 40,
  staggerItemMs: 320,
  staggerRise: 10,
  /** The page under a sheet steps back by this scale (depth, not blur). */
  sheetParentScale: 0.96,
  fastMs: 100,
  baseMs: 170,
  slowMs: 320,
  flashInMs: 160,
  flashOutMs: 160,
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;

/** Largest Dynamic Type multiplier for hero numbers (layout stays intact). */
export const MAX_FONT_SCALE_HERO = 1.3;
