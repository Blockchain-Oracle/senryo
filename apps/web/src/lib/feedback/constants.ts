/**
 * The web's feedback tables (the phone's haptic words, `apps/mobile/src/feedback/haptics.ts`, as vibration patterns;
 * Owarine/Tradash's haptic table, canton-season3 tradash/SPEC-chart.md §6). The sound cues are `@senryo/tokens`.
 */

export type HapticEvent = "tick" | "press" | "snap" | "confirm" | "filled" | "warn" | "fail" | "win" | "loss" | "move";

/** `navigator.vibrate` patterns in ms (Android and other browsers with the Vibration API). */
export const VIBRATE: Record<HapticEvent, number | number[]> = {
  tick: 3,
  press: 8,
  snap: 12,
  confirm: 10,
  filled: [12, 20, 12],
  warn: [80, 60, 80],
  fail: [80, 60, 80],
  win: [25, 35, 25, 35, 45],
  loss: 35,
  move: 6,
};

/** iPhone and iPad have no Vibration API: a hidden native switch is clicked 1–5 times (iOS 18 plays its haptic). */
export const IOS_CLICKS: Record<HapticEvent, number> = {
  tick: 1,
  press: 1,
  snap: 1,
  confirm: 1,
  filled: 2,
  warn: 2,
  fail: 2,
  win: 3,
  loss: 1,
  move: 1,
};
export const IOS_CLICK_GAP_MS = 70;

/** Web Audio: the oscillator stops this long after its envelope ends; a stuck context is rebuilt at most this often. */
export const VOICE_STOP_TAIL_S = 0.02;
export const AUDIO_STUCK_CHECK_MS = 400;
export const AUDIO_REBUILD_GAP_MS = 1_500;

/** `requestIdleCallback`'s deadline, and the fallback delay where it doesn't exist. */
export const IDLE_TIMEOUT_MS = 1_500;
export const IDLE_FALLBACK_MS = 200;

export const STORAGE = {
  feedback: "senryo.feedback.v1",
  privacy: "senryo.privacy.v1",
} as const;
