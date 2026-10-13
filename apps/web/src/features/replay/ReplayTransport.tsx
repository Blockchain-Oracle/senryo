"use client";
/**
 * The replay's transport row (Codex direction 18 §B; the phone's row in `ReplaySheet`): Play / Pause, the scrubber
 * (100 ms steps for the arrow keys), "0:04 / 0:14", and the preview's sound on or off — 44 px targets in a 48 px row.
 */
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { CSSProperties } from "react";
import { fire } from "@/lib/feedback";
import "./replay.css";

const PERCENT = 100;
const MS = 1_000;
const SECONDS = 60;
const SEEK_MS = 100;
const BUTTON =
  "flex size-11 items-center justify-center rounded-full hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-6";

const clock = (ms: number) => {
  const s = Math.round(ms / MS);
  return `${Math.floor(s / SECONDS)}:${String(s % SECONDS).padStart(2, "0")}`;
};

export function ReplayTransport({
  t,
  totalMs,
  ready,
  playing,
  sound,
  onToggle,
  onSeek,
  onSound,
}: {
  t: number;
  totalMs: number;
  ready: boolean;
  playing: boolean;
  sound: boolean;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onSound: () => void;
}) {
  return (
    <div className="flex h-12 items-center gap-2">
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          fire("tick", { cue: "tap" });
          onToggle();
        }}
        aria-label={playing ? "Pause" : "Play"}
        className={`${BUTTON} text-foreground`}
      >
        {playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="fill-current" />}
      </button>
      <input
        type="range"
        min={0}
        max={totalMs}
        step={SEEK_MS}
        value={t}
        disabled={!ready}
        aria-label="Replay position"
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ "--played": `${totalMs > 0 ? (t / totalMs) * PERCENT : 0}%` } as CSSProperties}
        className="replay-scrub h-11 flex-1"
      />
      <span className="text-caption tabular-nums text-muted-foreground">
        {clock(t)} / {clock(totalMs)}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={sound}
        aria-label="Sound in replay"
        onClick={() => {
          fire("tick", { cue: "toggle" });
          onSound();
        }}
        className={BUTTON}
      >
        {sound ? (
          <Volume2 aria-hidden className="text-foreground" />
        ) : (
          <VolumeX aria-hidden className="text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
