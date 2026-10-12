/**
 * Every sound on the web (D-317, F1; Owarine `lib/sound/trade.ts` and `features/games/audio.ts` via Mitoshi): the shared
 * cue map (`@senryo/tokens` `sound.ts`, which the phone renders to WAV) played live through Web Audio — no audio file
 * ships. Two buses under the master: effects (the cues) and music (`./music.ts`), each with its own volume, the music
 * through the tense low-pass and ducked under a verdict. "Interactive" latency, unlocked on the first gesture, resumed
 * when the tab returns, rebuilt if the context gets stuck. Every error is swallowed: a sound never breaks a call.
 */
import {
  type LadderCue,
  ladderRate,
  MUSIC_DUCK,
  MUSIC_DUCK_IN_S,
  MUSIC_DUCK_OUT_S,
  SOUND_ATTACK_S,
  SOUND_CUES,
  SOUND_FILTER_Q,
  SOUND_FLOOR,
  SOUND_HOLD_ATTACK_S,
  SOUND_HOLD_RELEASE_AT,
  SOUND_MASTER,
  SOUND_MIX,
  type SoundCue,
  type Voice,
} from "@senryo/tokens";
import { AUDIO_REBUILD_GAP_MS, AUDIO_STUCK_CHECK_MS, VOICE_STOP_TAIL_S } from "./constants";

const UNLOCK_EVENTS = ["touchend", "click", "keydown", "pointerup", "mousedown"] as const;
/** Cues that are verdicts: the music ducks under them. */
const VERDICTS: ReadonlySet<SoundCue> = new Set(["win", "loss", "refund", "verdict", "jackpot", "crash", "matchFound"]);
const NOISE_SECONDS = 1;
const OPEN_FILTER_HZ = 20_000;
const RELEASE_FRACTION = 0.3;

interface Graph {
  ctx: AudioContext;
  effects: GainNode;
  music: GainNode;
  tense: BiquadFilterNode;
}

let graph: Graph | null = null;
let noise: AudioBuffer | null = null;
let installed = false;
let lastRebuildMs = 0;
let everRan = false;
let muted = false;
let effectsVolume = 1;
let musicVolume = 1;
const rebuildListeners = new Set<() => void>();

function build(): boolean {
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  try {
    const ctx = new Ctor({ latencyHint: "interactive" });
    ctx.onstatechange = () => {
      if (ctx.state === "running") everRan = true;
    };
    if (ctx.state === "running") everRan = true;
    const master = ctx.createGain();
    master.gain.value = SOUND_MASTER;
    master.connect(ctx.destination);
    const effects = ctx.createGain();
    effects.gain.value = muted ? 0 : effectsVolume;
    effects.connect(master);
    const tense = ctx.createBiquadFilter();
    tense.type = "lowpass";
    tense.frequency.value = OPEN_FILTER_HZ;
    tense.connect(master);
    const music = ctx.createGain();
    music.gain.value = muted ? 0 : musicVolume;
    music.connect(tense);
    graph = { ctx, effects, music, tense };
    noise = null;
    for (const l of rebuildListeners) l();
    return true;
  } catch {
    return false;
  }
}

/** A one-sample silent buffer: what iOS needs, inside a gesture, to let the context run. */
function blip(c: AudioContext): void {
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start(0);
    src.onended = () => src.disconnect();
  } catch {
    // Ignored: the next gesture tries again.
  }
}

function rebuild(): void {
  const old = graph?.ctx;
  if (!build()) return;
  lastRebuildMs = Date.now();
  if (old && old.state !== "closed") void old.close().catch(() => undefined);
  if (graph && graph.ctx.state !== "running") void graph.ctx.resume().catch(() => undefined);
}

/** Every gesture: a closed context is rebuilt; a suspended one is nudged, and rebuilt if it stays stuck. */
function unlock(): void {
  if (!graph) {
    if (build() && graph) {
      const g = graph as Graph;
      blip(g.ctx);
      void g.ctx.resume().catch(() => undefined);
    }
    return;
  }
  const c = graph.ctx;
  if (c.state === "closed") {
    rebuild();
    if (graph) blip((graph as Graph).ctx);
    return;
  }
  if (c.state === "running") return;
  blip(c);
  void c.resume().catch(() => undefined);
  setTimeout(() => {
    const stuck = graph?.ctx === c && everRan && c.state !== "running" && document.visibilityState === "visible";
    if (stuck && Date.now() - lastRebuildMs > AUDIO_REBUILD_GAP_MS) rebuild();
  }, AUDIO_STUCK_CHECK_MS);
}

function resume(): void {
  const c = graph?.ctx;
  if (c && c.state !== "running" && c.state !== "closed") void c.resume().catch(() => undefined);
}

/** Mount once (the feedback loader does). Idempotent. */
export function installSounds(isMuted: boolean, volumes?: { effects: number; music: number }): void {
  muted = isMuted;
  if (volumes) setVolumes(volumes);
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = "playback";
    } catch {
      // Older Safari: the default session plays too.
    }
  }
  for (const e of UNLOCK_EVENTS) window.addEventListener(e, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resume();
  });
}

/** The graph the music sequencer books on (null before the first gesture), and a hook for a rebuilt context. */
export function audioGraph(): Graph | null {
  return graph;
}
export function onAudioRebuilt(listener: () => void): () => void {
  rebuildListeners.add(listener);
  return () => rebuildListeners.delete(listener);
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const buf = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

/** Book one voice at `start` into `out` (shared by the cues and the music). */
export function bookVoice(ctx: AudioContext, out: AudioNode, v: Voice, start: number, level: number, rate = 1): void {
  const peak = Math.max(SOUND_FLOOR, v.gain * level);
  const end = start + v.dur;
  const g = ctx.createGain();
  if (v.env === "hold") {
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + SOUND_HOLD_ATTACK_S);
    g.gain.setTargetAtTime(0, start + v.dur * SOUND_HOLD_RELEASE_AT, v.dur * RELEASE_FRACTION * RELEASE_FRACTION);
  } else {
    g.gain.setValueAtTime(SOUND_FLOOR, start);
    g.gain.exponentialRampToValueAtTime(peak, start + SOUND_ATTACK_S);
    g.gain.exponentialRampToValueAtTime(SOUND_FLOOR, end);
  }
  let tail: AudioNode = g;
  let filter: BiquadFilterNode | null = null;
  if (v.filter) {
    filter = ctx.createBiquadFilter();
    filter.type = v.filter.type;
    filter.Q.value = v.filter.q ?? SOUND_FILTER_Q;
    filter.frequency.setValueAtTime(v.filter.from, start);
    if (v.filter.to && v.filter.to !== v.filter.from) filter.frequency.exponentialRampToValueAtTime(v.filter.to, end);
    g.connect(filter);
    tail = filter;
  }
  tail.connect(out);
  let src: AudioScheduledSourceNode;
  if (v.type === "noise") {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    n.loop = true;
    src = n;
  } else {
    const osc = ctx.createOscillator();
    osc.type = v.type;
    if (v.detune) osc.detune.value = v.detune;
    osc.frequency.setValueAtTime(v.from * rate, start);
    if (v.to !== v.from) osc.frequency.exponentialRampToValueAtTime(v.to * rate, end);
    src = osc;
  }
  src.connect(g);
  src.start(start);
  src.stop(end + VOICE_STOP_TAIL_S);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
    filter?.disconnect();
  };
}

function voices(list: readonly Voice[], level: number, rate = 1): void {
  if (muted || !graph) return;
  resume();
  try {
    const t0 = graph.ctx.currentTime;
    for (const v of list) bookVoice(graph.ctx, graph.effects, v, t0 + v.at, level, rate);
  } catch {
    // Never let a sound break the flow.
  }
}

/** Down 6 dB in 80 ms and back over 400 ms: the music steps aside for a verdict (research 10 §7). */
function duck(): void {
  if (!graph || muted) return;
  const now = graph.ctx.currentTime;
  const g = graph.music.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(musicVolume * MUSIC_DUCK, now + MUSIC_DUCK_IN_S);
  g.linearRampToValueAtTime(musicVolume, now + MUSIC_DUCK_IN_S + MUSIC_DUCK_OUT_S);
}

export function playCue(cue: SoundCue): void {
  if (VERDICTS.has(cue)) duck();
  voices(SOUND_CUES[cue], SOUND_MIX[cue]);
}

/** A climbing cue at its ladder's step (the profit ladder, Lucky's reels, a streak's gaps…). */
export function playLadder(cue: LadderCue, step: number): void {
  voices(SOUND_CUES[cue], SOUND_MIX[cue], ladderRate(cue, step));
}

/** The profit cue at ladder step `step` (clamped to the two octaves). */
export function playProfitStep(step: number): void {
  playLadder("profit", step);
}

function applyVolumes(): void {
  if (!graph) return;
  graph.effects.gain.value = muted ? 0 : effectsVolume;
  graph.music.gain.value = muted ? 0 : musicVolume;
}

/** Sound off silences both buses (the music sequencer keeps its place). */
export function setSoundsMuted(next: boolean): void {
  muted = next;
  applyVolumes();
}

/** Effects and music volumes, 0–1 each (the Sound & vibration sheet). */
export function setVolumes(v: { effects: number; music: number }): void {
  effectsVolume = v.effects;
  musicVolume = v.music;
  applyVolumes();
}
