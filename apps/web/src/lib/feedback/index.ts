"use client";
/**
 * Sound & vibration on the web (the phone's `fire()`, `apps/mobile/src/feedback/fire.ts`; Mitoshi `lib/feedback.ts`):
 * one setting per device for sounds and haptics, and the one call site for both. Only the setting and a loader are in
 * the shell's first load; the engines (`./sound`, `./haptics`) load when the browser is idle, before the first tap, so
 * the tap that unlocks audio is already heard.
 *
 *   fire("tick")                       a chip, a tab, a key
 *   fire("filled", { cue: "open" })    a call filled
 *   fire("win", { cue: "win" })        a call won; fire("loss", { cue: "loss" }) lost
 *   fire("move", { profit: 3 })        one favourable step of an open call (the profit ladder)
 */
import type { SoundCue } from "@senryo/tokens";
import { useSyncExternalStore } from "react";
import { onIdle } from "@/lib/shell/idle";
import { type HapticEvent, STORAGE } from "./constants";

export type { HapticEvent } from "./constants";

export interface FeedbackSettings {
  sound: boolean;
  haptics: boolean;
}

export const FEEDBACK_DEFAULTS: FeedbackSettings = { sound: true, haptics: true };

type Engines = { sound: typeof import("./sound"); haptics: typeof import("./haptics") };

let settings: FeedbackSettings | null = null;
let engines: Engines | null = null;
let loading: Promise<Engines> | null = null;
const listeners = new Set<() => void>();

function read(): FeedbackSettings {
  if (settings) return settings;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.feedback) ?? "{}") as Partial<FeedbackSettings>;
    settings = {
      sound: typeof raw.sound === "boolean" ? raw.sound : FEEDBACK_DEFAULTS.sound,
      haptics: typeof raw.haptics === "boolean" ? raw.haptics : FEEDBACK_DEFAULTS.haptics,
    };
  } catch {
    settings = { ...FEEDBACK_DEFAULTS };
  }
  return settings;
}

/** Load the engines (idempotent) and apply the current setting to them. */
function loadFeedback(): Promise<Engines> {
  loading ??= Promise.all([import("./sound"), import("./haptics")]).then(([sound, haptics]) => {
    const s = read();
    sound.installSounds(!s.sound);
    haptics.installHaptics(s.haptics);
    engines = { sound, haptics };
    return engines;
  });
  return loading;
}

/** Warm the engines while the browser is idle (the shell calls this once). */
export function preloadFeedback(): () => void {
  return onIdle(() => void loadFeedback());
}

export function setFeedback(patch: Partial<FeedbackSettings>): void {
  settings = { ...read(), ...patch };
  try {
    localStorage.setItem(STORAGE.feedback, JSON.stringify(settings));
  } catch {
    // The choice holds for this page.
  }
  engines?.sound.setSoundsMuted(!settings.sound);
  engines?.haptics.setHapticsEnabled(settings.haptics);
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useFeedback(): FeedbackSettings {
  return useSyncExternalStore(subscribe, read, () => FEEDBACK_DEFAULTS);
}

/** A haptic word, optionally with a cue or a profit-ladder step; silent until the engines load. */
export function fire(event: HapticEvent, options: { cue?: SoundCue; profit?: number } = {}): void {
  const run = (e: Engines) => {
    e.haptics.haptic(event);
    if (options.cue) e.sound.playCue(options.cue);
    if (options.profit !== undefined) e.sound.playProfitStep(options.profit);
  };
  if (engines) run(engines);
  else void loadFeedback().then(run, () => undefined);
}

/** The shell's tap: the tap cue and a light haptic. */
export function tapFeedback(): void {
  fire("press", { cue: "tap" });
}
