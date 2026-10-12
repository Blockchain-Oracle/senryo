"use client";
/**
 * Sound & vibration on the web (D-317, F1–F3; the phone's `fire()`, `apps/mobile/src/feedback/fire.ts`; Mitoshi
 * `lib/feedback.ts`): one setting per device — sound, haptics, effects and music volumes, the terminal's music and its
 * track — and the one call site for cues, ladders and haptics. Only the setting and a loader are in the shell's first
 * load; the engines (`./sound`, `./music`, `./haptics`) load when the browser is idle, before the first tap, so the tap
 * that unlocks audio is already heard. In development every fired cue is logged on `window.__senryoCues` (F's gate).
 *
 *   fire("tick")                                   a chip, a tab, a key
 *   fire("filled", { cue: "open" })                a call filled
 *   fire("win", { cue: "win" })                    a call won; fire("loss", { cue: "loss" }) lost
 *   fire("move", { profit: 3 })                    one favourable step of an open call (the profit ladder)
 *   fire("tick", { ladder: ["reelLock", 1] })      a climbing cue at its step
 *   music("games") / music(null)                   a song plays (crossfading) / stops
 */
import type { LadderCue, SongName, SoundCue } from "@senryo/tokens";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { onIdle } from "@/lib/shell/idle";
import { type HapticEvent, STORAGE } from "./constants";

export type { HapticEvent } from "./constants";

export interface FeedbackSettings {
  sound: boolean;
  haptics: boolean;
  /** Effects and music volumes, 0–1. */
  effects: number;
  music: number;
  /** The terminal's music (off by default, D-317) and its track. */
  terminalMusic: boolean;
  track: SongName;
}

/** Effects and haptics on; the games' music at 20 % of the master by default (D-317); the terminal's off. */
export const FEEDBACK_DEFAULTS: FeedbackSettings = {
  sound: true,
  haptics: true,
  effects: 1,
  music: 0.6,
  terminalMusic: false,
  track: "arcade",
};

type Engines = {
  sound: typeof import("./sound");
  music: typeof import("./music");
  haptics: typeof import("./haptics");
};

let settings: FeedbackSettings | null = null;
let engines: Engines | null = null;
let loading: Promise<Engines> | null = null;
const listeners = new Set<() => void>();

function read(): FeedbackSettings {
  if (settings) return settings;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.feedback) ?? "{}") as Partial<FeedbackSettings>;
    const unit = (v: unknown, d: number) => (typeof v === "number" && v >= 0 && v <= 1 ? v : d);
    settings = {
      sound: typeof raw.sound === "boolean" ? raw.sound : FEEDBACK_DEFAULTS.sound,
      haptics: typeof raw.haptics === "boolean" ? raw.haptics : FEEDBACK_DEFAULTS.haptics,
      effects: unit(raw.effects, FEEDBACK_DEFAULTS.effects),
      music: unit(raw.music, FEEDBACK_DEFAULTS.music),
      terminalMusic: typeof raw.terminalMusic === "boolean" ? raw.terminalMusic : FEEDBACK_DEFAULTS.terminalMusic,
      track: typeof raw.track === "string" ? (raw.track as SongName) : FEEDBACK_DEFAULTS.track,
    };
  } catch {
    settings = { ...FEEDBACK_DEFAULTS };
  }
  return settings;
}

/** Load the engines (idempotent) and apply the current setting to them. */
function loadFeedback(): Promise<Engines> {
  loading ??= Promise.all([import("./sound"), import("./music"), import("./haptics")]).then(
    ([sound, music, haptics]) => {
      const s = read();
      sound.installSounds(!s.sound, { effects: s.effects, music: s.music });
      haptics.installHaptics(s.haptics);
      engines = { sound, music, haptics };
      return engines;
    },
  );
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
  engines?.sound.setVolumes({ effects: settings.effects, music: settings.music });
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

/** The development cue log: every fired cue in order (F's gate reads it through the preview tools). */
function logCue(name: string): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const w = window as unknown as { __senryoCues?: string[] };
  w.__senryoCues ??= [];
  w.__senryoCues.push(name);
}

/** A haptic word, optionally with a cue, a profit-ladder step or a climbing cue; silent until the engines load. */
export function fire(
  event: HapticEvent,
  options: { cue?: SoundCue; profit?: number; ladder?: readonly [LadderCue, number] } = {},
): void {
  const run = (e: Engines) => {
    e.haptics.haptic(event);
    if (options.cue) {
      logCue(options.cue);
      e.sound.playCue(options.cue);
    }
    if (options.profit !== undefined) {
      logCue(`profit:${options.profit}`);
      e.sound.playProfitStep(options.profit);
    }
    if (options.ladder) {
      logCue(`${options.ladder[0]}:${options.ladder[1]}`);
      e.sound.playLadder(options.ladder[0], options.ladder[1]);
    }
  };
  if (engines) run(engines);
  else void loadFeedback().then(run, () => undefined);
}

/** Play a song (crossfading from the one playing) or stop with null; a game asks on Play, the terminal per setting. */
export function music(song: SongName | null): void {
  logCue(`music:${song ?? "off"}`);
  const run = (e: Engines) => e.music.setMusic(song);
  if (engines) run(engines);
  else void loadFeedback().then(run, () => undefined);
}

/** The tense filter while an open position is down 5 % or more. */
export function musicTense(tense: boolean): void {
  engines?.music.setMusicTense(tense);
}

/** The shell's tap: the tap cue and a light haptic. */
export function tapFeedback(): void {
  fire("press", { cue: "tap" });
}

/** A sheet's open and close sounds (F1): every drawer and modal says when it arrives and when it leaves. */
export function useSheetCues(open: boolean): void {
  const was = useRef(open);
  useEffect(() => {
    if (open === was.current) return;
    was.current = open;
    fire("tick", { cue: open ? "sheetOpen" : "sheetClose" });
  }, [open]);
}

/** A cue with no haptic (a reel's ratchet ticks 14 times a second: heard, not felt). */
export function sound(cue: SoundCue): void {
  logCue(cue);
  const run = (e: Engines) => e.sound.playCue(cue);
  if (engines) run(engines);
  else void loadFeedback().then(run, () => undefined);
}
