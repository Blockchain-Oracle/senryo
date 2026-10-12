/**
 * The music on the phone (D-317, F2): the web's songs (`@senryo/tokens` `music.ts`) rendered to seamless loops by
 * `scripts/gen-sounds.mjs`, played looped through `expo-audio` — a 1.2 s fade-in, a 0.5 s crossfade to a new song,
 * ducked 6 dB under a verdict, and, with no live filter here, a crossfade to the track's low-passed twin while an open
 * call is down 5 % or more. Silent in the background; mixes with other audio and follows the ringer switch like the cues.
 */
import {
  MUSIC_CROSSFADE_S,
  MUSIC_DUCK,
  MUSIC_DUCK_IN_S,
  MUSIC_DUCK_OUT_S,
  MUSIC_FADE_IN_S,
  MUSIC_TENSE_IN_S,
  MUSIC_TENSE_OUT_S,
  SOUND_MASTER,
  type SongName,
} from "@senryo/tokens";
import { type AudioPlayer, createAudioPlayer } from "expo-audio";
import { AppState } from "react-native";
import { SONG_SOURCES, TENSE_SOURCES } from "./cue-sources";

const FADE_STEP_MS = 40;
const MS = 1_000;

interface Deck {
  song: SongName;
  main: AudioPlayer;
  tense: AudioPlayer | null;
  /** 0–1: how far the deck is faded in, and how far toward its tense twin. */
  level: number;
  tension: number;
}

let deck: Deck | null = null;
let musicVolume = 1;
let duck = 1;
let wanted: SongName | null = null;
let tenseWanted = false;
let timer: ReturnType<typeof setInterval> | null = null;
const fading: { deck: Deck; from: number; to: number; at: number; ms: number; done?: () => void }[] = [];

function apply(d: Deck): void {
  const base = SOUND_MASTER * musicVolume * duck * d.level;
  d.main.volume = base * (1 - d.tension);
  if (d.tense) d.tense.volume = base * d.tension;
}

function tick(): void {
  const now = Date.now();
  for (const f of [...fading]) {
    const k = Math.min(1, (now - f.at) / f.ms);
    f.deck.level = f.from + (f.to - f.from) * k;
    if (k >= 1) {
      fading.splice(fading.indexOf(f), 1);
      f.done?.();
    }
  }
  if (deck) {
    const target = tenseWanted ? 1 : 0;
    const rate = FADE_STEP_MS / ((tenseWanted ? MUSIC_TENSE_IN_S : MUSIC_TENSE_OUT_S) * MS);
    deck.tension += Math.max(-rate, Math.min(rate, target - deck.tension));
    apply(deck);
  }
  for (const f of fading) apply(f.deck);
  if (!deck && fading.length === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function run(): void {
  timer ??= setInterval(tick, FADE_STEP_MS);
}

function fade(d: Deck, to: number, seconds: number, done?: () => void): void {
  fading.push({ deck: d, from: d.level, to, at: Date.now(), ms: seconds * MS, ...(done ? { done } : {}) });
  run();
}

function release(d: Deck): void {
  try {
    d.main.remove();
    d.tense?.remove();
  } catch {
    // Already gone.
  }
}

function start(song: SongName): void {
  try {
    const main = createAudioPlayer(SONG_SOURCES[song]);
    main.loop = true;
    const tenseSource = TENSE_SOURCES[song];
    const tense = tenseSource ? createAudioPlayer(tenseSource) : null;
    if (tense) tense.loop = true;
    const old = deck;
    deck = { song, main, tense, level: 0, tension: 0 };
    apply(deck);
    main.play();
    tense?.play();
    fade(deck, 1, old ? MUSIC_CROSSFADE_S : MUSIC_FADE_IN_S);
    if (old) fade(old, 0, MUSIC_CROSSFADE_S, () => release(old));
  } catch {
    // Music is decoration.
  }
}

function sync(): void {
  const active = AppState.currentState === "active";
  if (!wanted || !active) {
    if (deck) {
      const old = deck;
      deck = null;
      fade(old, 0, MUSIC_CROSSFADE_S, () => release(old));
    }
    return;
  }
  if (deck?.song !== wanted) start(wanted);
}

AppState.addEventListener("change", sync);

/** Play `song` (crossfading from whatever plays) or stop with null. */
export function setMusic(song: SongName | null): void {
  wanted = song;
  sync();
}

/** The tense twin while an open call is down 5 % or more. */
export function setMusicTense(tense: boolean): void {
  tenseWanted = tense;
  if (deck) run();
}

/** Down 6 dB in 80 ms and back over 400 ms: the music steps aside for a verdict. */
export function duckMusic(): void {
  if (!deck) return;
  duck = MUSIC_DUCK;
  apply(deck);
  setTimeout(
    () => {
      duck = 1;
      if (deck) apply(deck);
    },
    (MUSIC_DUCK_IN_S + MUSIC_DUCK_OUT_S) * MS,
  );
}

export function setMusicVolume(volume: number): void {
  musicVolume = volume;
  if (deck) apply(deck);
}

export function releaseMusic(): void {
  wanted = null;
  if (deck) release(deck);
  deck = null;
}
