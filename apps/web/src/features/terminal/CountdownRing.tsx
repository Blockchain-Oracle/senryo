"use client";
/**
 * The selected lane's ring (the phone's `CountdownRing`): how much of the window's calling time is gone, on the
 * server's seconds, gliding between them; it turns the warning colour for the last ten seconds.
 */
const SIZE = 18;
const STROKE = 2;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const WARN_FROM_SEC = 10;

export function CountdownRing({ fromSec, toSec, nowSec }: { fromSec: number; toSec: number; nowSec: number }) {
  const span = Math.max(1, toSec - fromSec);
  const left = Math.max(0, toSec - nowSec);
  const done = Math.min(1, Math.max(0, (nowSec - fromSec) / span));
  return (
    <svg aria-hidden width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="countdown-ring">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="countdown-track" strokeWidth={STROKE} fill="none" />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        strokeWidth={STROKE}
        fill="none"
        className="countdown-arc"
        data-warn={left <= WARN_FROM_SEC ? "" : undefined}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * done}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </svg>
  );
}
