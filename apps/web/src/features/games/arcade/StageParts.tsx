"use client";
/**
 * The stage's plates (R7.1): the HUD's top bar (score and best, the combo, sound, pause and exit), the 3-2-1-GO, the
 * pause plate and the game-over card (score, a "New best" stamp, where it ranked, the run's numbers, Play again, Share,
 * Exit). In the arena's ink; every control is a 44 px button.
 */
import type { RunStat } from "@senryo/arcade";
import { Pause, Play, Share2, Volume2, VolumeX, X } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fire, setFeedback, useFeedback } from "@/lib/feedback";

const CARD_READY_MS = 600;

export interface StageResult {
  score: number;
  isBest: boolean;
  /** "Checked by replay · 3rd on the board", "Not ranked: …", or null for a guest. */
  note: string | null;
  stats: RunStat[];
}

export function StageTop({
  score,
  combo,
  best,
  canPause,
  onPause,
  onExit,
}: {
  score: RefObject<HTMLSpanElement | null>;
  combo: RefObject<HTMLSpanElement | null>;
  best: number | null;
  canPause: boolean;
  onPause: () => void;
  onExit: () => void;
}) {
  const fb = useFeedback();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <span ref={score} className="arcade-score">
          0
        </span>
        {best !== null ? <span className="arcade-dim text-meta">Best {best.toLocaleString()}</span> : null}
      </div>
      <span ref={combo} className="arcade-combo" />
      <div className="flex gap-2">
        <button
          type="button"
          className="arcade-icon"
          aria-label={fb.sound ? "Mute" : "Sound on"}
          aria-pressed={fb.sound}
          onClick={() => {
            setFeedback({ sound: !fb.sound });
            fire("tick", { cue: "toggle" });
          }}
        >
          {fb.sound ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
        </button>
        {canPause ? (
          <button type="button" className="arcade-icon" aria-label="Pause" onClick={onPause}>
            <Pause aria-hidden className="size-5" />
          </button>
        ) : null}
        <button type="button" className="arcade-icon" aria-label="Exit the game" onClick={onExit}>
          <X aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}

export function Countdown({ n }: { n: number }) {
  return (
    <div className="arcade-count" aria-live="assertive">
      <span key={n} className={n === 0 ? "is-go" : undefined}>
        {n === 0 ? "GO" : n}
      </span>
    </div>
  );
}

export function PausePlate({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div className="arcade-plate">
      <div className="arcade-card">
        <span className="font-semibold text-section-title">Paused</span>
        <Button size="xl" className="arcade-cta w-full" onClick={onResume} autoFocus>
          <Play aria-hidden className="size-5" /> Resume
        </Button>
        <Button size="lg" variant="ghost" className="arcade-ghost w-full" onClick={onExit}>
          Exit
        </Button>
      </div>
    </div>
  );
}

export function OverPlate({
  title,
  result,
  checking,
  signedIn,
  onSignIn,
  onAgain,
  onShare,
  onExit,
}: {
  title: string;
  result: StageResult;
  checking: boolean;
  signedIn: boolean;
  /** Leaves the stage for the account drawer. */
  onSignIn: () => void;
  onAgain: () => void;
  onShare: () => void;
  onExit: () => void;
}) {
  // A key still held from the run (Space) must not land on the focused Play again: the card listens after a beat.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), CARD_READY_MS);
    return () => window.clearTimeout(t);
  }, []);
  const when = (act: () => void) => () => {
    if (ready) act();
  };
  return (
    <div className="arcade-plate" role="dialog" aria-label={`${title} · run over`}>
      <div className="arcade-card">
        <span className="arcade-dim text-meta uppercase tracking-widest">{title}</span>
        <span className="arcade-score">{result.score.toLocaleString()}</span>
        {result.isBest ? <span className="arcade-stamp text-section-title">NEW BEST</span> : null}
        <span className="arcade-dim text-meta" aria-live="polite">
          {checking ? "Checking the run by replay…" : result.note}
        </span>
        <dl className="arcade-stats">
          {result.stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <Button size="xl" className="arcade-cta w-full" onClick={when(onAgain)} autoFocus>
          Play again
        </Button>
        <div className="flex w-full gap-2">
          <Button size="lg" variant="ghost" className="arcade-ghost flex-1" onClick={when(onShare)}>
            <Share2 aria-hidden className="size-4" /> Share
          </Button>
          <Button size="lg" variant="ghost" className="arcade-ghost flex-1" onClick={when(onExit)}>
            Exit
          </Button>
        </div>
        {signedIn ? null : (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="arcade-dim text-meta">Sign in to rank your runs.</span>
            <Button size="sm" variant="ghost" className="arcade-ghost" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
