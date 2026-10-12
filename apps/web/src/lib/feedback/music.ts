/**
 * The music on the web (D-317, F2; Owarine `lib/sound/music.ts` and `features/games/bed.ts`): a song from
 * `@senryo/tokens` `music.ts` booked a sixteenth at a time on the Web Audio clock — a 25 ms timer books every step that
 * starts in the next 100 ms at its exact time, so a busy main thread cannot smear the beat — into the music bus
 * (`./sound.ts`: its own volume, the tense low-pass, ducked under verdicts). A new song crossfades over 0.5 s; the
 * first fades in over 1.2 s; hidden tabs fall silent and pick up again on return. Plays once audio is unlocked.
 */
import {
  MUSIC_CROSSFADE_S,
  MUSIC_FADE_IN_S,
  MUSIC_GAIN,
  MUSIC_TENSE_HZ,
  MUSIC_TENSE_IN_S,
  MUSIC_TENSE_OUT_S,
  type SongName,
  songSteps,
  stepSeconds,
  stepVoices,
} from "@senryo/tokens";
import { audioGraph, bookVoice, onAudioRebuilt } from "./sound";

const LOOKAHEAD_S = 0.1;
const TICK_MS = 25;
const START_DELAY_S = 0.05;
const STOP_TAU_S = 0.15;
const OPEN_FILTER_HZ = 20_000;
const MS = 1_000;
/** A crossfade's old bus is dropped after twice its length. */
const DROP_AFTER = 2;

let wanted: SongName | null = null;
let playing: { song: SongName; bus: GainNode; ctx: AudioContext } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextAt = 0;
let bound = false;

function schedule(): void {
  if (!playing) return;
  const { ctx, bus, song } = playing;
  const stepSec = stepSeconds(song);
  const steps = songSteps(song);
  while (nextAt < ctx.currentTime + LOOKAHEAD_S) {
    for (const v of stepVoices(song, step)) bookVoice(ctx, bus, v, nextAt + v.at, MUSIC_GAIN);
    nextAt += stepSec;
    step = (step + 1) % steps;
  }
}

function stopNow(): void {
  if (timer) clearInterval(timer);
  timer = null;
  if (playing) {
    const { bus, ctx } = playing;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(0, ctx.currentTime, STOP_TAU_S);
    setTimeout(() => bus.disconnect(), MUSIC_CROSSFADE_S * DROP_AFTER * MS);
  }
  playing = null;
}

function start(song: SongName): void {
  const g = audioGraph();
  if (!g || g.ctx.state === "closed") return;
  const { ctx } = g;
  const now = ctx.currentTime;
  const fade = playing ? MUSIC_CROSSFADE_S : MUSIC_FADE_IN_S;
  if (playing) stopNow();
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + fade);
  bus.connect(g.music);
  playing = { song, bus, ctx };
  step = 0;
  nextAt = now + START_DELAY_S;
  timer = setInterval(schedule, TICK_MS);
  schedule();
}

function apply(): void {
  const hidden = document.visibilityState === "hidden";
  if (!wanted || hidden) {
    stopNow();
    return;
  }
  if (playing?.song !== wanted || !timer) start(wanted);
}

function bind(): void {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", apply);
  // The first gesture unlocks audio: music asked for before it starts then.
  for (const e of ["pointerup", "keydown", "touchend"] as const) {
    window.addEventListener(e, () => wanted && !timer && apply(), { passive: true });
  }
  onAudioRebuilt(() => {
    playing = null;
    if (timer) clearInterval(timer);
    timer = null;
    apply();
  });
}

/** Play `song` (a crossfade from whatever plays), or stop with null. */
export function setMusic(song: SongName | null): void {
  bind();
  wanted = song;
  apply();
}

/** The tense low-pass while the open position is down 5 % or more (research 01 §1.8). */
export function setMusicTense(tense: boolean): void {
  const g = audioGraph();
  if (!g) return;
  const now = g.ctx.currentTime;
  const f = g.tense.frequency;
  f.cancelScheduledValues(now);
  f.setValueAtTime(f.value, now);
  f.exponentialRampToValueAtTime(
    tense ? MUSIC_TENSE_HZ : OPEN_FILTER_HZ,
    now + (tense ? MUSIC_TENSE_IN_S : MUSIC_TENSE_OUT_S),
  );
}
