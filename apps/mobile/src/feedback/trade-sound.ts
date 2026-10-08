/**
 * The terminal's cues (Tradash's cue map, re-synthesised: `scripts/gen-trade-sounds.mjs`): tap, open, close, win, loss,
 * the profit ladder (one major-pentatonic step higher per favourable move, two octaves), the adverse step, and the
 * surge / mega / slump flourishes. Two players per cue so a quick repeat overlaps; levels are the reference mix.
 * Players load on first use; every failure is swallowed — a sound never breaks a call.
 */
import { type AudioPlayer, type AudioSource, createAudioPlayer } from "expo-audio";
import { AppState } from "react-native";

export type TradeCue = "tap" | "open" | "close" | "win" | "loss" | "adverse" | "slump" | "surge" | "mega";

const SOURCES: Record<TradeCue, AudioSource> = {
  tap: require("../../assets/sounds/trade/tap.wav"),
  open: require("../../assets/sounds/trade/open.wav"),
  close: require("../../assets/sounds/trade/close.wav"),
  win: require("../../assets/sounds/trade/win.wav"),
  loss: require("../../assets/sounds/trade/loss.wav"),
  adverse: require("../../assets/sounds/trade/adverse.wav"),
  slump: require("../../assets/sounds/trade/slump.wav"),
  surge: require("../../assets/sounds/trade/surge.wav"),
  mega: require("../../assets/sounds/trade/mega.wav"),
};

const LADDER: readonly AudioSource[] = [
  require("../../assets/sounds/trade/profit-0.wav"),
  require("../../assets/sounds/trade/profit-1.wav"),
  require("../../assets/sounds/trade/profit-2.wav"),
  require("../../assets/sounds/trade/profit-3.wav"),
  require("../../assets/sounds/trade/profit-4.wav"),
  require("../../assets/sounds/trade/profit-5.wav"),
  require("../../assets/sounds/trade/profit-6.wav"),
  require("../../assets/sounds/trade/profit-7.wav"),
  require("../../assets/sounds/trade/profit-8.wav"),
  require("../../assets/sounds/trade/profit-9.wav"),
  require("../../assets/sounds/trade/profit-10.wav"),
];

/** The reference mix (cue gain × voice level), under the app's master level. */
const MASTER = 0.7;
const GAIN: Record<TradeCue | "profit", number> = {
  tap: 0.3,
  open: 0.55,
  close: 0.55,
  win: 0.5,
  loss: 0.4,
  profit: 0.35,
  adverse: 0.07,
  slump: 0.14,
  surge: 0.13,
  mega: 0.16,
};
const POOL = 2;
const pools = new Map<string, { players: AudioPlayer[]; next: number }>();

function play(key: string, source: AudioSource, gain: number): void {
  if (AppState.currentState !== "active") return;
  try {
    let entry = pools.get(key);
    if (!entry) {
      entry = { players: Array.from({ length: POOL }, () => createAudioPlayer(source)), next: 0 };
      pools.set(key, entry);
    }
    const player = entry.players[entry.next % POOL];
    entry.next += 1;
    if (!player) return;
    player.volume = MASTER * gain;
    void player.seekTo(0).then(() => player.play());
  } catch {
    // Audio is decoration; the call it accompanies never depends on it.
  }
}

export function playCue(cue: TradeCue): void {
  play(cue, SOURCES[cue], GAIN[cue]);
}

/** The profit cue at ladder step `step` (clamped to the two octaves). */
export function playProfitStep(step: number): void {
  const i = Math.max(0, Math.min(LADDER.length - 1, step));
  const source = LADDER[i];
  if (source) play(`profit-${i}`, source, GAIN.profit);
}

export function releaseCues(): void {
  for (const entry of pools.values()) for (const p of entry.players) p.remove();
  pools.clear();
}
