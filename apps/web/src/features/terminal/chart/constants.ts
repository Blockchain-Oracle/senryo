/**
 * The web chart's tuning tables: Tradash's numbers as Owarine's canvas engine re-implements them (SPEC-chart §2–5),
 * with the phone's Senryo additions — adaptive easing for a ~1 s feed (D-272), the zone on the call's side of K, and
 * level tags that give way to the pill and stack at the edges (`apps/mobile/src/features/terminal/chart`).
 */

export const SAMPLE_CAPACITY = 600;
export const SAMPLE_MS = 1000 / 60;
export const MAX_SAMPLES_PER_FRAME = 8;
export const MAX_FRAME_MS = 250;
export const SETTLE_FRACTION = 1e-7;
export const MAX_DPR = 2;
/** τ = max(Tradash's 84 ms, 0.5 × the measured tick interval): a 1 s feed glides across each second. */
export const BASE_TAU_MS = 84;
export const TICK_FOLLOW = 0.5;
export const TICK_EMA = 0.3;
export const MAX_TICK_GAP_MS = 5000;

/** Rolling digits: per-sample approach and snap. */
export const DIGIT_EASE = 0.22;
export const DIGIT_SNAP = 0.002;
export const ROLL_EPSILON = 1e-3;
export const DIGITS = 10;

/** The plot spans 15 grid steps; a step ≈ 0.01 % of price, made nice (1, 2, 5, 10 × 10ⁿ). */
export const SPAN_STEPS = 15;
export const STEP_FRACTION = 1e-4;
export const NICE_CUTS = [1.5, 3.5, 7.5] as const;
export const NICE_STEPS = [1, 2, 5, 10] as const;
export const MINOR_PER_MAJOR = 5;
export const MAX_TICKS = 400;
export const EPSILON = 1e-9;
export const TICK_DECIMALS = 10;
export const EDGE_FADE_PX = 14;
/** Catmull-Rom → Bézier control-point divisor (tension 1/6). */
export const CATMULL = 6;

export const FADE_FRACTION = 0.32;
export const FADE_MID = 0.45;
export const FADE_MID_ALPHA = 0.55;

export const PAD_Y = 28;
export const PILL_RIGHT = 14;
export const PILL_GAP = 10;
export const PILL_PAD_X = 18;
export const MIN_PLOT_LEFTOVER = 96;
export const PILL_H = 26;
export const PILL_H_POSITION = 34;
export const PILL_TEXT_RIGHT = 9;
export const PILL_ROW_OFFSET = 7.5;
export const ROLL_PITCH = 20;
export const ROLL_PITCH_SMALL = 15;
export const LABEL_RIGHT = 14;
export const TAG_H = 15;
export const TAG_PAD = 5;
export const TAG_RADIUS = 3;
export const EDGE_TAG_INSET = 9;
export const EDGE_TAG_GAP = 4;
/** A level tag that would sit under the pill moves to the end of its line, this far left of the head dot. */
export const TAG_CLEAR = 8;
export const HEAD_R = 3.5;
export const GLOW_W = 6;
export const GLOW_ALPHA = 0.18;
export const LINE_W = 2;
export const GRID_ALPHA = 0.06;
export const ZONE_ALPHA = 0.07;
export const MAJOR_TICK = 6;
export const MINOR_TICK = 3;
export const TICK_INSET = 3;
export const MAJOR_TICK_ALPHA = 0.9;
export const MINOR_TICK_ALPHA = 0.45;
export const LABEL_SPAN = 1.2;
export const MARK = "千両";
export const MARK_ALPHA = 0.07;
export const MARK_MAX_W = 260;
export const MARK_PLOT_SHARE = 0.5;
export const LEVEL_ALPHA = { line: 0.7, entry: 0.55 } as const;
export const LEVEL_DASH = { line: [2, 3], entry: [4, 4] } as const;
export const HALF_PIXEL = 0.5;

/** Canvas fonts (the phone's sizes; Inter with tabular figures stands in for the phone's monospace). */
export const FONT_PX = { axis: 11, pill: 13, pillSmall: 11, tag: 10, mark: 96 } as const;
export const FONT_WEIGHT = { axis: 500, pill: 700, tag: 700, mark: 700 } as const;

/** The dot field (Tradash `DotGrid`): 34 px, half the line's scroll, drift by price velocity in grid steps. */
export const DOT_SPACING = 34;
export const DOT_RADIUS = 1.1;
export const DOT_SCROLL = 0.5;
export const DRIFT_GAIN = 4;
export const DRIFT_CLAMP = 6;
export const DRIFT_EASE = 0.06;
export const DRIFT_WRAP = 1000;
