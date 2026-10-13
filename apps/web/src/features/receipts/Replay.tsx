"use client";
/**
 * A finished trade's replay (R5.19; Tradash's replay by way of Owarine's `ReplaySheet`): the price path this browser
 * recorded while it was open, drawn as it plays back in at most 12 s, with the PnL the screen showed rolling beside it,
 * the entry (and a call's line) dashed behind, Play / Pause / Again and a scrubber. A trade recorded with holes says
 * how much of it was seen; one not recorded here shows nothing.
 */
import { type Episode, playMs, pnlAt, replayable } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { moneyDecimals, Odometer, viewDollars } from "@/components/ui/odometer";
import { fire } from "@/lib/feedback";

const HEIGHT = 160;
const PAD = 8;
const RANGE_PAD = 0.15;
const MIN_RANGE_SHARE = 0.0001;
const DOT = 4;
const LINE = 2;
const DPR_MAX = 2;
const DASH = { entry: 4, line: 2, lineGap: 3 } as const;
const ENTRY_DASH = [DASH.entry, DASH.entry];
const LINE_DASH = [DASH.line, DASH.lineGap];
/** Half a pixel: a 1 px line sits on the pixel grid. */
const CRISP = 0.5;
const LEVEL_ALPHA = 0.6;
const SCRUB_STEPS = 1000;
const SECOND_MS = 1_000;
const MINUTE_S = 60;
const HOUR_S = 3_600;

function draw(canvas: HTMLCanvasElement, e: Episode, upTo: number): void {
  const ctx = canvas.getContext("2d");
  const s = e.samples;
  const first = s[0];
  const last = s.at(-1);
  if (!ctx || !first || !last) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(canvas);
  const v = (n: string) => css.getPropertyValue(n).trim();
  const prices = [...s.map((x) => x[1]), ...(e.entry ? [e.entry] : []), ...(e.line ? [e.line] : [])];
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  const pad = Math.max((hi - lo) * RANGE_PAD, hi * MIN_RANGE_SHARE);
  lo -= pad;
  hi += pad;
  const w = rect.width;
  const h = rect.height;
  const x = (t: number) => ((t - first[0]) / Math.max(1, last[0] - first[0])) * (w - PAD * 2) + PAD;
  const y = (p: number) => h - PAD - ((p - lo) / (hi - lo)) * (h - PAD * 2);
  ctx.clearRect(0, 0, w, h);
  const level = (price: number | null, dash: number[]) => {
    if (!price) return;
    ctx.save();
    ctx.strokeStyle = v("--text-3");
    ctx.globalAlpha = LEVEL_ALPHA;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y(price)) + CRISP);
    ctx.lineTo(w, Math.round(y(price)) + CRISP);
    ctx.stroke();
    ctx.restore();
  };
  level(e.entry, ENTRY_DASH);
  level(e.line, LINE_DASH);
  const tone = pnlAt(s, upTo) >= 0n ? v("--up") : v("--down");
  ctx.strokeStyle = tone;
  ctx.lineWidth = LINE;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let head: [number, number] | null = null;
  for (const [t, p] of s) {
    if (t > upTo) break;
    if (head) ctx.lineTo(x(t), y(p));
    else ctx.moveTo(x(t), y(p));
    head = [x(t), y(p)];
  }
  ctx.stroke();
  if (head) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(head[0], head[1], DOT, 0, Math.PI * 2);
    ctx.fill();
  }
}

const lifeText = (ms: number) => {
  const s = Math.max(0, Math.round(ms / SECOND_MS));
  return s < MINUTE_S ? `${s}s` : s < HOUR_S ? `${Math.round(s / MINUTE_S)}m` : `${(s / HOUR_S).toFixed(1)}h`;
};

/** The replay of a finished trade when this browser recorded it (nothing otherwise). */
export function ReplayFor({ chainId, bookKey }: { chainId: number; bookKey: string }) {
  const episode = useEpisode(chainId, bookKey);
  return episode && replayable(episode) ? <Replay episode={episode} /> : null;
}

export function Replay({ episode: e }: { episode: Episode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const first = e.samples[0]?.[0] ?? 0;
  const last = e.samples.at(-1)?.[0] ?? first;
  const upTo = first + (last - first) * progress;

  useEffect(() => {
    if (!playing) return;
    const span = playMs(e);
    let raf = 0;
    let prev = performance.now();
    const step = (now: number) => {
      const dt = now - prev;
      prev = now;
      setProgress((p) => {
        const next = Math.min(1, p + dt / span);
        if (next >= 1) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, e]);

  useEffect(() => {
    if (canvas.current) draw(canvas.current, e, upTo);
  }, [e, upTo]);

  const pnl = viewDollars(pnlAt(e.samples, upTo));
  const done = progress >= 1;
  return (
    <section aria-label="Replay" className="flex w-full max-w-md flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-row-title">Replay · {lifeText(last - first)}</h3>
        <Odometer kind="pnl" value={pnl} decimals={moneyDecimals(pnl)} sensitive className="text-row-title" />
      </div>
      <canvas
        ref={canvas}
        aria-label={`${e.symbol} ${e.label}, the price while it was open`}
        style={{ height: HEIGHT }}
        className="w-full"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={done ? "Play again" : playing ? "Pause" : "Play"}
          onClick={() => {
            fire("press", { cue: "tap" });
            if (done) setProgress(0);
            setPlaying(done || !playing);
          }}
          className="flex size-11 items-center justify-center rounded-full bg-secondary"
        >
          {done ? (
            <RotateCcw aria-hidden className="size-4" />
          ) : playing ? (
            <Pause aria-hidden className="size-4" />
          ) : (
            <Play aria-hidden className="size-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={SCRUB_STEPS}
          value={Math.round(progress * SCRUB_STEPS)}
          aria-label="Scrub the replay"
          onChange={(ev) => {
            setPlaying(false);
            setProgress(Number(ev.target.value) / SCRUB_STEPS);
          }}
          className="flex-1 accent-foreground"
        />
      </div>
    </section>
  );
}
