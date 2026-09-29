"use client"

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
const GREEN = 'var(--chart-2, #22c55e)'

const HAIRLINE = 'var(--border)'

const RED = 'var(--chart-down, #ef5350)'

const SANS = 'inherit'

const SURFACE = 'var(--card)'

const TEXT = 'var(--foreground)'

const TEXT_MUTED = 'var(--muted-foreground)'

const usd = (n: number, dp = 2) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

/** Portfolio · Balance Chart Pro — the wallet-value area chart. Trend picks the
 *  line color, the fill fades to nothing (0.16 → 0), max/min float at their true
 *  points instead of a y-axis, and the x-axis is labels-only. Scrub with the
 *  pointer, a finger, or the arrow keys, and a value card reads the point; the
 *  1H–All pills reseed the series. ShapeShift's BalanceChart/PrimaryChart (visx)
 *  redrawn in plain SVG. (shapeshift-web, MIT — Ink register.) */

const TIMEFRAMES = ['1H', '24H', '1W', '1M', '1Y', 'All'] as const
type Timeframe = (typeof TIMEFRAMES)[number]

const X_LABELS: Record<Timeframe, string[]> = {
  '1H': ['12:10', '12:25', '12:40', '12:55'],
  '24H': ['06:00', '12:00', '18:00', '00:00', '06:00'],
  '1W': ['Mon', 'Wed', 'Fri', 'Sun'],
  '1M': ['May 24', 'Jun 3', 'Jun 13', 'Jun 20'],
  '1Y': ['Aug', 'Nov', 'Feb', 'May'],
  All: ['2022', '2023', '2024', '2025', '2026'],
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 640
const H = 240
const N = 90
/** line width in px; it also sets when the line is allowed to smooth (below) */
const STROKE = 2.1

/** Catmull-Rom through the samples, written as cubic Béziers, so the line reads as one smooth stroke */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

export interface BalanceChartProProps {
  base?: number
  className?: string
}

export default function BalanceChartPro({ base = 48213, className }: BalanceChartProProps) {
  const [tf, setTf] = useState<Timeframe>('24H')
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  /* SMOOTHING HAS A THRESHOLD. When the points sit closer than two stroke widths apart, a
     reversal's up and down strokes merge into a smear that reads as noise, so the line is
     smoothed for legibility. At any wider spacing the real data is drawn, segment by segment,
     because there the detail is readable and smoothing would only invent a calmer market.
     Either way the readout reads the real value, never a smoothed one. */
  const [plotW, setPlotW] = useState(W)
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setPlotW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const smooth = plotW / (N - 1) < 2 * STROKE

  const { pts, path, area, min, max, iMin, iMax, up } = useMemo(() => {
    const rand = mulberry32(11 + TIMEFRAMES.indexOf(tf) * 97)
    const drift = tf === '1W' ? -0.12 : 0.35 // one timeframe trends down so RED earns its keep
    const vals: number[] = []
    let v = base * 0.94
    for (let i = 0; i < N; i++) {
      v += (rand() - 0.42) * base * 0.006 + drift * base * 0.0008
      vals.push(v)
    }
    /* below the threshold only: two passes of a 7-sample mean, drawn as one curve */
    const drawn = vals.slice()
    if (smooth) {
      for (let pass = 0; pass < 2; pass++) {
        const src = drawn.slice()
        for (let i = 0; i < N; i++) {
          const lo = Math.max(0, i - 3)
          const hi = Math.min(N - 1, i + 3)
          let sum = 0
          for (let j = lo; j <= hi; j++) sum += src[j]
          drawn[i] = sum / (hi - lo + 1)
        }
      }
    }
    const lo = Math.min(...drawn)
    const hi = Math.max(...drawn)
    const nx = (i: number) => (i / (N - 1)) * W
    const ny = (val: number) => H - 14 - ((val - lo) / (hi - lo || 1)) * (H - 44)
    const xy = drawn.map((p, i) => ({ x: nx(i), y: ny(p) }))
    const d = smooth ? smoothPath(xy) : xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const rawLo = Math.min(...vals)
    const rawHi = Math.max(...vals)
    return {
      /* the dot sits on the drawn line; the number is the real value at that point */
      pts: vals.map((val, i) => ({ x: xy[i].x, y: xy[i].y, val })),
      path: d,
      area: `${d} L${W},${H} L0,${H} Z`,
      min: rawLo,
      max: rawHi,
      iMin: vals.indexOf(rawLo),
      iMax: vals.indexOf(rawHi),
      up: vals[N - 1] >= vals[0],
    }
  }, [base, tf, smooth])

  const hue = up ? GREEN : RED
  const hovered = hover != null ? pts[hover] : null
  /* the card sits on whichever side of the point keeps it in view */
  const cardRight = hovered ? hovered.x / W < 0.5 : false
  /* an extreme near either edge aligns to that edge instead of centring half off the plot */
  const edge = (x: number) => ((x / W) * 100 <= 12 ? { left: 0 } : (x / W) * 100 >= 88 ? { right: 0 } : { left: `${(x / W) * 100}%`, transform: 'translateX(-50%)' })

  const scrubTo = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const i = Math.round(((clientX - rect.left) / rect.width) * (N - 1))
    setHover(Math.max(0, Math.min(N - 1, i)))
  }

  return (
    <div className={`w-full max-w-[640px] ${className ?? ''}`} style={{ fontFamily: SANS }}>
      {/* The plot takes focus: left and right walk the readout a point at a time (shift for
          ten), Home and End jump to the ends, Escape lets go. */}
      <div
        className="rounded-md pb-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="group"
        aria-label="Balance chart. Use the left and right arrow keys to read values."
        onFocus={() => setHover((h) => h ?? N - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1
          const at = hover ?? N - 1
          const next =
            e.key === 'ArrowLeft' ? at - step : e.key === 'ArrowRight' ? at + step : e.key === 'Home' ? 0 : e.key === 'End' ? N - 1 : null
          if (e.key === 'Escape') setHover(null)
          if (next === null) return
          e.preventDefault()
          setHover(Math.max(0, Math.min(N - 1, next)))
        }}
      >
        <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-[240px] w-full cursor-crosshair"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Balance over ${tf}, ${usd(pts[N - 1].val, 0)} now`}
          /* pointer events, so a finger scrubs as well as a mouse; pan-y leaves vertical
             swipes to the page, and a touch readout stays put after the finger lifts */
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(e) => scrubTo(e.clientX)}
          onPointerMove={(e) => scrubTo(e.clientX)}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null)
          }}
        >
          <defs>
            <linearGradient id="bcp-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? 'var(--chart-2, #22c55e)' : 'var(--chart-down, #ef5350)'} stopOpacity="0.16" />
              <stop offset="100%" stopColor={up ? 'var(--chart-2, #22c55e)' : 'var(--chart-down, #ef5350)'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#bcp-fill)" />
          <path d={path} fill="none" stroke={hue} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* The crosshair and the dot live in HTML over the plot, not in the svg: the svg
            stretches with preserveAspectRatio="none", so a circle drawn inside it turns into
            an ellipse at any width but 640. Positioned by percentage, it stays round. No
            transition on either: the readout follows the pointer, it does not animate. */}
        {hovered && (
          <>
            <i
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-0 border-l border-dashed"
              style={{ left: `${(hovered.x / W) * 100}%`, borderColor: 'var(--chart-1)', opacity: 0.5 }}
            />
            <i
              aria-hidden
              className="pointer-events-none absolute block h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, background: hue, boxShadow: `0 0 0 1.5px ${SURFACE}` }}
            />
          </>
        )}
        {/* floating extremes — the y-axis ShapeShift doesn't draw */}
        <span className="pointer-events-none absolute text-[11px] font-medium tabular-nums" style={{ ...edge(pts[iMax].x), top: `${(pts[iMax].y / H) * 100}%`, marginTop: -18, color: TEXT_MUTED }}>
          {usd(max, 0)}
        </span>
        <span className="pointer-events-none absolute text-[11px] font-medium tabular-nums" style={{ ...edge(pts[iMin].x), top: `${(pts[iMin].y / H) * 100}%`, marginTop: 8, color: TEXT_MUTED }}>
          {usd(min, 0)}
        </span>
        {/* hover card: lifted off the plot on a soft shadow, beside the point on whichever side
            keeps it in view, and never animated (it tracks the point exactly) */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5"
            role="status"
            style={{
              left: `${(hovered.x / W) * 100}%`,
              top: `clamp(2px, calc(${(hovered.y / H) * 100}% - 22px), calc(100% - 52px))`,
              transform: cardRight ? 'translateX(14px)' : 'translateX(calc(-100% - 14px))',
              background: SURFACE,
              borderColor: HAIRLINE,
              boxShadow: '0 8px 24px -6px rgba(0,0,0,0.35)',
            }}
          >
            <div className="text-[13px] font-bold tabular-nums" style={{ color: TEXT }}>{usd(hovered.val)}</div>
            <div className="text-[10px]" style={{ color: TEXT_MUTED }}>Jul 20, {String(Math.floor((hover! / N) * 24)).padStart(2, '0')}:00</div>
          </div>
        )}
        </div>
      </div>
      {/* x labels — no ticks, no axis line */}
      <div className="mt-1 flex justify-between px-1 text-[11px] tabular-nums" style={{ color: TEXT_MUTED }}>
        {X_LABELS[tf].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      {/* time controls — one pill slides between the timeframes */}
      <div className="relative mx-auto mt-3 flex w-full max-w-[360px] gap-1" role="group" aria-label="Timeframe">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/[0.07] transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.16,0.5,1)] motion-reduce:transition-none"
          style={{
            width: `calc((100% - ${(TIMEFRAMES.length - 1) * 4}px) / ${TIMEFRAMES.length})`,
            transform: `translateX(calc(${TIMEFRAMES.indexOf(tf)} * (100% + 4px)))`,
          }}
        />
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTf(t)}
            aria-pressed={tf === t}
            className="relative z-[1] h-7 flex-1 rounded-full text-[12px] font-medium tracking-[0.01em] tabular-nums transition-[color,transform] duration-200 active:scale-[0.94] motion-reduce:transition-none"
            style={{ color: tf === t ? TEXT : TEXT_MUTED }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Demo() {
  return (
    <div className="flex min-h-[340px] w-full items-center justify-center p-6">
      <BalanceChartPro />
    </div>
  )
}
