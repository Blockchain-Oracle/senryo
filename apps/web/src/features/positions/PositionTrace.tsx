"use client";
/**
 * The position's own path (D-343, Codex direction 15; the phone's `PositionTrace`): its recorded PnL as a 1.5 px line
 * over a faint zero, broken across holes in the recording, with a still endpoint, coloured by the PnL's sign now. Too
 * little recorded leaves the slot quiet; hidden balances suppress it.
 */
import { type ReplaySample, traceGeometry } from "@senryo/calls";
import { cn } from "@/lib/utils";

const W = 72;
const H = 24;
const LINE = 1.5;
const END_R = 2;

export function PositionTrace({ samples, dim }: { samples: readonly ReplaySample[] | null; dim: boolean }) {
  const g = traceGeometry(samples, W, H);
  if (!g) return <span aria-hidden className="block h-6 w-18 shrink-0" />;
  const tone =
    g.tone === "up" ? "stroke-up fill-up" : g.tone === "down" ? "stroke-down fill-down" : "stroke-text-3 fill-text-3";
  return (
    <svg
      aria-hidden
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("shrink-0", tone, dim && "opacity-40")}
    >
      <line x1={0} x2={W} y1={g.zeroY} y2={g.zeroY} strokeWidth={1} className="stroke-text-3 opacity-35" />
      <path d={g.d} strokeWidth={LINE} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {dim ? null : <circle cx={g.end.x} cy={g.end.y} r={END_R} stroke="none" />}
    </svg>
  );
}
