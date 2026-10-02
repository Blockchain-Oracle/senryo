"use client";

// 21st: tom_ui/qr-code (#12248, search "dotted qr code") — the `qrcode` module matrix drawn as dots, finder patterns
// skipped and drawn separately. Senryo (as on the phone, Solflare S21): round finder eyes (a ring around a disc), dark
// ink on the fixed paper plate in both themes (scanners need the contrast), error correction H so the badge in the
// middle never breaks a read, three dot buckets that settle like particles. The payload is exact from the first frame.
import { motion, useReducedMotion } from "motion/react";
import { create } from "qrcode";
import { type ReactNode, useMemo } from "react";
import { EASE_OUT, QR_BUCKET_STAGGER, QR_REVEAL_S } from "@/lib/constants/motion";

const QUIET = 3;
const FINDER = 7;
const FINDER_CENTER = 3.5;
const RING_RADIUS = 3;
const RING_STROKE = 1;
const EYE_RADIUS = 1.5;
const DOT_RADIUS = 0.4;
const HALF = 0.5;
const HOLE_SHARE = 0.22;
const BUCKETS = 3;
const HASH_A = 31;
const HASH_B = 17;
const FROM_SCALE = 0.9;

const dot = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const inFinder = (row: number, col: number, n: number) =>
  (row < FINDER && col < FINDER) || (row < FINDER && col >= n - FINDER) || (row >= n - FINDER && col < FINDER);

export function DottedQr({ value, label, center }: { value: string; label: string; center?: ReactNode }) {
  const reduce = useReducedMotion();
  const { buckets, extent, finders } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "H" });
    const n = modules.size;
    const hole = (n * HOLE_SHARE) / 2;
    const mid = n / 2;
    const paths = Array.from({ length: BUCKETS }, () => "");
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (!modules.get(row, col) || inFinder(row, col, n)) continue;
        if (center && Math.abs(row + HALF - mid) < hole && Math.abs(col + HALF - mid) < hole) continue;
        const bucket = (row * HASH_A + col * HASH_B) % BUCKETS;
        paths[bucket] += dot(col + QUIET + HALF, row + QUIET + HALF, DOT_RADIUS);
      }
    }
    const corners = [
      [0, 0],
      [0, n - FINDER],
      [n - FINDER, 0],
    ] as const;
    return {
      buckets: paths,
      extent: n + QUIET * 2,
      finders: corners.map(([r, c]) => ({ cx: c + QUIET + FINDER_CENTER, cy: r + QUIET + FINDER_CENTER })),
    };
  }, [value, center]);

  const reveal = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, scale: FROM_SCALE },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: QR_REVEAL_S, delay: i * QR_BUCKET_STAGGER * QR_REVEAL_S, ease: EASE_OUT },
        };

  return (
    <div role="img" aria-label={label} className="relative w-full rounded-lg bg-qr-paper p-2">
      <svg viewBox={`0 0 ${extent} ${extent}`} className="block aspect-square w-full" aria-hidden>
        <motion.g {...reveal(0)} style={{ transformOrigin: "center" }}>
          {finders.map((f) => (
            <g key={`${f.cx}:${f.cy}`}>
              <circle
                cx={f.cx}
                cy={f.cy}
                r={RING_RADIUS}
                stroke="var(--qr-ink)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <circle cx={f.cx} cy={f.cy} r={EYE_RADIUS} fill="var(--qr-ink)" />
            </g>
          ))}
        </motion.g>
        {buckets.map((d, i) => (
          <motion.path
            key={String(i)}
            d={d}
            fill="var(--qr-ink)"
            {...reveal(i + 1)}
            style={{ transformOrigin: "center" }}
          />
        ))}
      </svg>
      {center ? <div className="absolute inset-0 grid place-items-center">{center}</div> : null}
    </div>
  );
}
