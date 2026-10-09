/**
 * The terminal's sounds on the web (Owarine `lib/sound/trade.ts` via Mitoshi): the shared cue table
 * (`@senryo/tokens` `sound.ts`, which the phone renders to WAV) played live through Web Audio — no audio file ships.
 * "Interactive" latency, unlocked on the first gesture, resumed when the tab returns, rebuilt if the context gets stuck.
 * Every error is swallowed: a sound never breaks a call.
 */
import {
  SEMITONES_PER_OCTAVE,
  SOUND_ATTACK_S,
  SOUND_CUES,
  SOUND_FLOOR,
  SOUND_LADDER_SEMITONES,
  SOUND_MASTER,
  SOUND_MIX,
  type SoundCue,
  type Voice,
} from "@senryo/tokens";
import { AUDIO_REBUILD_GAP_MS, AUDIO_STUCK_CHECK_MS, VOICE_STOP_TAIL_S } from "./constants";

const UNLOCK_EVENTS = ["touchend", "click", "keydown", "pointerup", "mousedown"] as const;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let installed = false;
let lastRebuildMs = 0;
let everRan = false;
let muted = false;

function build(): boolean {
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  try {
    const next = new Ctor({ latencyHint: "interactive" });
    next.onstatechange = () => {
      if (next.state === "running") everRan = true;
    };
    if (next.state === "running") everRan = true;
    out = next.createGain();
    out.gain.value = SOUND_MASTER;
    out.connect(next.destination);
    ctx = next;
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
  const old = ctx;
  if (!build()) return;
  lastRebuildMs = Date.now();
  if (old && old.state !== "closed") void old.close().catch(() => undefined);
  if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
}

/** Every gesture: a closed context is rebuilt; a suspended one is nudged, and rebuilt if it stays stuck. */
function unlock(): void {
  if (!ctx) {
    if (build() && ctx) {
      blip(ctx);
      void (ctx as AudioContext).resume().catch(() => undefined);
    }
    return;
  }
  const c = ctx;
  if (c.state === "closed") {
    rebuild();
    if (ctx) blip(ctx);
    return;
  }
  if (c.state === "running") return;
  blip(c);
  void c.resume().catch(() => undefined);
  setTimeout(() => {
    const stuck = ctx === c && everRan && c.state !== "running" && document.visibilityState === "visible";
    if (stuck && Date.now() - lastRebuildMs > AUDIO_REBUILD_GAP_MS) rebuild();
  }, AUDIO_STUCK_CHECK_MS);
}

function resume(): void {
  if (ctx && ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => undefined);
}

/** Mount once (the feedback loader does). Idempotent. */
export function installSounds(isMuted: boolean): void {
  muted = isMuted;
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

function voices(list: readonly Voice[], level: number, rate = 1): void {
  if (muted || !ctx || !out) return;
  resume();
  try {
    const t0 = ctx.currentTime;
    for (const v of list) {
      const start = t0 + v.at;
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.from * rate, start);
      if (v.to !== v.from) osc.frequency.exponentialRampToValueAtTime(v.to * rate, start + v.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(SOUND_FLOOR, start);
      g.gain.exponentialRampToValueAtTime(Math.max(SOUND_FLOOR, v.gain * level), start + SOUND_ATTACK_S);
      g.gain.exponentialRampToValueAtTime(SOUND_FLOOR, start + v.dur);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + v.dur + VOICE_STOP_TAIL_S);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    }
  } catch {
    // Never let a sound break the flow.
  }
}

export function playCue(cue: SoundCue): void {
  voices(SOUND_CUES[cue], SOUND_MIX[cue]);
}

/** The profit cue at ladder step `step` (clamped to the two octaves). */
export function playProfitStep(step: number): void {
  const i = Math.max(0, Math.min(SOUND_LADDER_SEMITONES.length - 1, step));
  const semis = SOUND_LADDER_SEMITONES[i] ?? 0;
  voices(SOUND_CUES.profit, SOUND_MIX.profit, 2 ** (semis / SEMITONES_PER_OCTAVE));
}

export function setSoundsMuted(next: boolean): void {
  muted = next;
}
