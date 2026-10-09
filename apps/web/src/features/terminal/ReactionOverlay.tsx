"use client";
/**
 * Tradash's reactions overlay (`aX`, via Owarine's `ReactionOverlay` and the phone's): an inset edge glow for 0.9 s on
 * a surge (deeper for a mega move) or a slump, and emoji callouts that ride the price head — at most two, each living
 * by its tone (`CALLOUT_LIFETIME_MS`), springing in (bouncier for epic) and lifting out. CSS keyframes instead of a
 * motion runtime (the terminal's bundle); the head follows the chart's frame through a transform, never a render.
 */
import { CALLOUT_LIFETIME_MS, type CalloutTone } from "@senryo/calls";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { ChartFrame } from "./chart/chart-engine";

const MAX_SHOWN = 2;
const FLASH_MS = 900;
const EXIT_MS = 220;

export interface ReactionOverlayHandle {
  callout(tone: CalloutTone, emoji: string, text: string): void;
  flash(favorable: boolean, mega: boolean): void;
  /** Every chart frame: the callouts follow the head. */
  frame(frame: ChartFrame | null): void;
}

interface Shown {
  id: number;
  tone: CalloutTone;
  emoji: string;
  text: string;
  leaving: boolean;
}

export const ReactionOverlay = forwardRef<ReactionOverlayHandle>(function ReactionOverlay(_props, ref) {
  const head = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const [flash, setFlash] = useState<{ id: number; favorable: boolean; mega: boolean } | null>(null);
  const seq = useRef(0);

  useImperativeHandle(ref, () => ({
    callout(tone, emoji, text) {
      const id = ++seq.current;
      setShown((s) => [...s, { id, tone, emoji, text, leaving: false }].slice(-MAX_SHOWN));
      const life = CALLOUT_LIFETIME_MS[tone];
      setTimeout(() => setShown((s) => s.map((x) => (x.id === id ? { ...x, leaving: true } : x))), life - EXIT_MS);
      setTimeout(() => setShown((s) => s.filter((x) => x.id !== id)), life);
    },
    flash(favorable, mega) {
      const id = ++seq.current;
      setFlash({ id, favorable, mega });
      setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), FLASH_MS);
    },
    frame(frame) {
      const el = head.current;
      if (el && frame) el.style.transform = `translate3d(${frame.headX}px, ${frame.headY}px, 0)`;
    },
  }));

  return (
    <div aria-hidden className="reaction-layer">
      {flash ? (
        <div
          key={flash.id}
          className="reaction-flash"
          data-tone={flash.favorable ? "up" : "down"}
          data-mega={flash.mega ? "" : undefined}
        />
      ) : null}
      <div ref={head} className="reaction-head">
        <div className="reaction-stack">
          {shown.map((c) => (
            <div key={c.id} className="reaction-callout" data-tone={c.tone} data-leaving={c.leaving ? "" : undefined}>
              <span className="reaction-emoji">{c.emoji}</span>
              {c.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
