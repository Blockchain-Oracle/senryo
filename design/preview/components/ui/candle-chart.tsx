import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* ── inlined from lab/shared.ts ─────────────────────────────────────────── */

/** signature expo-out ease used across the site */
const EASE = [0.16, 1, 0.3, 1] as const

/** INHERIT, not Sora. The lab pins the brand face because the lab is ours; a
 *  published component that forces its own font overrides the host's theme,
 *  which is what 21st's guidelines call out. Every other kit here does the same. */
const SANS = 'inherit' 

/** true inside a snapshot browser — feeds freeze so visual diffs are real */
const isSnapshot = () =>
  typeof navigator !== 'undefined' && /\bChromatic\b/.test(navigator.userAgent)

/* ── inlined from lab/trade/tradeData.ts ────────────────────────────────── */

/** up / buy — the fixed GREEN. down / sell — a red pulled into the same band. */
const UP = 'var(--chart-up, #34c28a)'
const DOWN = 'var(--chart-candle-down, #D0625F)'

interface Candle {
  o: number
  h: number
  l: number
  c: number
  v: number
  /** epoch ms — labels count forward from the series start */
  t: number
}

/** deterministic PRNG (mulberry32) so every render agrees — no Math.random */
function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** rally → crash → chop keyframes (progress 0..1 → price), interpolated per candle */
const ARC: Array<[number, number]> = [
  [0, 0.24], [0.1, 0.34], [0.22, 0.6], [0.3, 0.88], [0.36, 1],
  [0.44, 0.68], [0.5, 0.45], [0.56, 0.6], [0.62, 0.33], [0.68, 0.26],
  [0.74, 0.42], [0.8, 0.31], [0.86, 0.19], [0.92, 0.29], [1, 0.35],
]

const lerpArc = (f: number) => {
  const hi = ARC.findIndex(([x]) => x >= f)
  if (hi <= 0) return ARC[Math.max(0, hi)][1]
  const [x0, y0] = ARC[hi - 1]
  const [x1, y1] = ARC[hi]
  return y0 + ((f - x0) / (x1 - x0)) * (y1 - y0)
}

interface CandleSeries {
  candles: Candle[]
  min: number
  max: number
  maxVolume: number
}

/** Build `count` candles across a fixed price band, shaped by the arc above. */
function makeCandles(seed: number, count = 96, ceil = 3000): CandleSeries {
  const rand = mulberry32(seed)
  const floor = ceil * 0.12
  const span = ceil - floor
  const start = Date.UTC(2025, 4, 12) // 12 May 2025
  const step = 6 * 36e5

  const candles: Candle[] = []
  let prev = floor + lerpArc(0) * span
  for (let i = 0; i < count; i++) {
    const o = prev
    const base = floor + lerpArc(i / (count - 1)) * span
    const c = Math.max(floor * 0.6, base * (1 + (rand() - 0.5) * 0.1))
    const h = Math.max(o, c) * (1 + rand() * 0.03)
    const l = Math.min(o, c) * (1 - rand() * 0.03)
    candles.push({ o, h, l, c, v: Math.abs(c - o) * 0.05 + rand() * 12, t: start + i * step })
    prev = c
  }

  return {
    candles,
    min: Math.min(...candles.map((k) => k.l)),
    max: Math.max(...candles.map((k) => k.h)),
    maxVolume: Math.max(...candles.map((k) => k.v)),
  }
}

const fmtUsd = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtAxis = (v: number) => (v === 0 ? '$0' : `$${Math.round(v).toLocaleString('en-US')}`)

const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })

const fmtStamp = (t: number) =>
  new Date(t)
    .toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })
    .replace(',', '') + ' UTC'

/* ── inlined from lab/BalanceChartPro.tsx ──────────────────────────────── */

/** balanceSeries' own axis — distinct from the component's TIMEFRAMES below */
const BAL_TIMEFRAMES = ['1H', '24H', '1W', '1M', '1Y', 'All'] as const
type BalTimeframe = (typeof BAL_TIMEFRAMES)[number]

const N = 90

function balanceSeries(base: number, tf: BalTimeframe = '24H', changePct?: number, seed?: number): number[] {
  const rand = mulberry32(seed ?? 11 + BAL_TIMEFRAMES.indexOf(tf) * 97)
  const drift = tf === '1W' ? -0.12 : 0.35
  const vals: number[] = []
  let v = base * 0.94
  for (let i = 0; i < N; i++) {
    v += (rand() - 0.42) * base * 0.006 + drift * base * 0.0008
    vals.push(v)
  }
  const end = vals[N - 1]
  if (end !== 0) {
    const k = base / end
    for (let i = 0; i < N; i++) vals[i] *= k
  }
  if (changePct !== undefined && vals[0] !== 0) {
    const open = base / (1 + changePct / 100)
    const ramp = open / vals[0]
    for (let i = 0; i < N; i++) vals[i] *= Math.pow(ramp, 1 - i / (N - 1))
  }
  return vals
}

/* ── the component ──────────────────────────────────────────────────────── */

/** #64 Candle Chart — a trading terminal's price panel rebuilt in the ink language:
 *  OHLC candles + a volume strip, a crosshair that reads the exact bar, and a
 *  gliding-thumb timeframe switch. Direction is the only thing that carries hue —
 *  every number sits in mono ink. Seeded data, so the tape never disagrees. */

const VB_W = 560
const VB_H = 300
const AXIS_W = 46
const VOL_H = 46
const GAP = 8

/** resize bounds — component width (px) and volume-pane height (viewBox units) */
const MIN_W = 340
const MAX_W = 920
const MIN_VOL = 20
const MAX_VOL = 120

const TIMEFRAMES = ['1D', '5D', '1M', '6M', '1Y'] as const
/** candles visible per preset — wheel on the date axis scrubs between these */
const TF_COUNT: Record<(typeof TIMEFRAMES)[number], number> = { '1D': 24, '5D': 40, '1M': 60, '6M': 80, '1Y': 96 }
/** wheel-zoom bounds — visible candle count + price-axis scale factor */
const MIN_VISIBLE = 12
const Y_SCALE_MIN = 0.4
const Y_SCALE_MAX = 1.6

export type CandleChartProps = {
  seed?: number
  symbol?: string
  className?: string
  /** market label after the symbol; null hides it */
  exchange?: string | null
  /** price ceiling of the seeded series — scales the whole y-axis */
  ceil?: number
  /** Pin the series so its LAST CLOSE is this price, and band-scale the axis to
   *  the visible candles instead of running from zero. The fix that lets this
   *  chart sit above an order book without contradicting it: without `mid` the
   *  demo arc ends wherever the seed lands (~0.41 × ceil) and the 0-based axis
   *  prints gridlines no book would recognise. */
  mid?: number
  /** how the series is drawn — candles, a close line, or OHLC bars */
  kind?: 'candles' | 'line' | 'bars'
  /** price / axis formatters (default: USD) */
  priceFmt?: (n: number) => string
  axisFmt?: (n: number) => string
  /** false = hide the header row (host page provides its own price chrome) */
  chrome?: boolean
  /** fill: the chart stops being a 600px card and takes the whole pane — the
   *  viewBox is measured from the container in 1:1 px, so nothing stretches and
   *  the axis type stays at its authored size however wide the pane gets. */
  fill?: boolean
}

export default function CandleChart({
  seed = 51,
  symbol = 'NOVX',
  className,
  exchange = 'MERIDIAN',
  ceil = 3000,
  priceFmt = fmtUsd,
  axisFmt = fmtAxis,
  chrome = true,
  mid,
  kind = 'candles',
  fill = false,
}: CandleChartProps) {
  const reduced = useReducedMotion() || isSnapshot()
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('6M')
  const [hover, setHover] = useState<number | null>(null)
  /* which pane the pointer is in — the tooltip reads OHLC over price, volume over volume */
  const [zone, setZone] = useState<'price' | 'volume'>('price')
  const svgRef = useRef<SVGSVGElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  /* resizable: component width (left-edge handle) + volume-pane height (divider) */
  const [width, setWidth] = useState<number | null>(null)
  const [volH, setVolH] = useState(VOL_H)
  const widthDrag = useRef<{ startX: number; startW: number; max: number } | null>(null)
  const volDrag = useRef(false)

  /* fill mode: the plot box IS the viewBox (1 unit = 1 px), measured live, so a
     wide pane gets more chart rather than a scaled-up drawing */
  const plotRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = plotRef.current
    if (!fill || !el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      setBox({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill])

  const VW = fill && box ? Math.max(240, box.w) : VB_W
  const VH = fill && box ? Math.max(160, box.h) : VB_H
  const plotH = VH - volH - GAP

  const { candles, maxVolume } = useMemo(() => {
    if (mid == null) return makeCandles(seed, 96, ceil)
    // Pinned mode builds the candles FROM balanceSeries(mid) — the same walk the
    // balance charts draw and the stats bar's 24h range derives from. One
    // generator means the chart's journey, the strip's range and the book's mid
    // cannot disagree. (Scaling the demo arc instead pinned the endpoint but
    // kept its 2.4x peak — a fall from $157k over a 24h range of $59.9-64.6k.)
    const walk = balanceSeries(mid, '24H')
    let s2 = (seed * 2654435761) >>> 0
    const rnd = () => {
      s2 = (s2 * 1103515245 + 12345) & 0x7fffffff
      return s2 / 0x7fffffff
    }
    const start = Date.UTC(2025, 4, 12)
    const candles: Candle[] = walk.map((c, i) => {
      const o = i === 0 ? c : walk[i - 1]
      const h = Math.max(o, c) * (1 + rnd() * 0.0011)
      const l = Math.min(o, c) * (1 - rnd() * 0.0011)
      return { o, h, l, c, v: Math.abs(c - o) * 0.4 + rnd() * 14, t: start + i * 6 * 36e5 }
    })
    return { candles, maxVolume: Math.max(...candles.map((k) => k.v)) }
  }, [seed, ceil, mid])
  const n = candles.length

  /* wheel zoom — visible window (date axis / presets) + price-axis scale (numbers) */
  const [visible, setVisible] = useState(TF_COUNT['6M'])
  const [yScale, setYScale] = useState(1)
  const axisZoneRef = useRef<HTMLDivElement>(null)
  const dateAxisRef = useRef<HTMLDivElement>(null)
  /* vertical drag on the price axis — same gesture as the wheel zoom */
  const yDrag = useRef<{ startY: number; startS: number } | null>(null)

  const view = useMemo(() => candles.slice(n - Math.min(visible, n)), [candles, n, visible])
  const vn = view.length

  const active: Candle = view[Math.min(hover ?? vn - 1, vn - 1)]
  const change = active.c - active.o
  const changePct = (change / active.o) * 100
  const up = change >= 0
  const totalPct = ((view[vn - 1].c - view[0].o) / view[0].o) * 100
  const totalUp = totalPct >= 0

  const plotW = VW - AXIS_W
  const slot = plotW / vn
  const bodyW = slot * 0.58
  const xMid = (i: number) => i * slot + slot / 2
  /* price ceiling scales with the axis wheel, but never clips the tallest visible wick */
  const maxHigh = useMemo(() => Math.max(...view.map((k) => k.h)), [view])
  const minLow = useMemo(() => Math.min(...view.map((k) => k.l)), [view])
  // pinned mode: the axis is a BAND around the visible candles (the wheel still
  // zooms it, around the band's centre); demo mode keeps the original 0-based
  // ceiling so every existing consumer renders identically
  const banded = mid != null
  const mid0 = (maxHigh + minLow) / 2
  const half = ((maxHigh - minLow) / 2) * 1.06 * (banded ? yScale : 1)
  const effCeil = banded ? mid0 + half : Math.max(ceil * yScale, maxHigh * 1.02)
  const effFloor = banded ? mid0 - half : 0
  const yPrice = (v: number) => (1 - (v - effFloor) / (effCeil - effFloor || 1)) * plotH

  const ticks = banded
    ? [effCeil, mid0 + half / 3, mid0 - half / 3, effFloor]
    : [effCeil, (effCeil * 2) / 3, effCeil / 3, 0]
  const dateLabels = useMemo(
    () => Array.from({ length: 6 }, (_, i) => view[Math.min(vn - 1, Math.floor((i * vn) / 6))]),
    [view, vn],
  )

  /* native non-passive wheel listeners (React's onWheel is passive, so it can't
     stop the page from scrolling) — axis column zooms price, date row zooms time */
  useEffect(() => {
    const axis = axisZoneRef.current
    const dates = dateAxisRef.current
    const onAxisWheel = (e: WheelEvent) => {
      e.preventDefault()
      setYScale((s) => Math.max(Y_SCALE_MIN, Math.min(Y_SCALE_MAX, s * Math.exp(e.deltaY * 0.0016))))
    }
    const onDateWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      setHover(null)
      setVisible((v) => Math.round(Math.max(MIN_VISIBLE, Math.min(96, v + d * 0.12))))
    }
    axis?.addEventListener('wheel', onAxisWheel, { passive: false })
    dates?.addEventListener('wheel', onDateWheel, { passive: false })
    return () => {
      axis?.removeEventListener('wheel', onAxisWheel)
      dates?.removeEventListener('wheel', onDateWheel)
    }
  }, [])

  const onMove = (e: React.PointerEvent) => {
    const el = svgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * VW
    const py = ((e.clientY - r.top) / r.height) * VH
    setHover(Math.max(0, Math.min(vn - 1, Math.floor(px / slot))))
    setZone(py > plotH + GAP / 2 ? 'volume' : 'price')
  }

  const tipLeft = hover !== null && hover > n / 2

  return (
    <div
      ref={rootRef}
      className={`${fill ? 'flex h-full w-full flex-col' : 'w-full max-w-[600px]'} ${className ?? ''}`}
      style={!fill && width !== null ? { width, maxWidth: width } : undefined}
    >
      {/* header — symbol + price / range switch */}
      {chrome && (
      <div className="flex shrink-0 items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.1em] text-foreground/40">{symbol}</span>
            {exchange && <span className="text-[9px] uppercase tracking-[0.1em] text-foreground/25">· {exchange}</span>}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="tabular-nums text-foreground/90" style={{ fontFamily: SANS, fontSize: 24, lineHeight: 1 }}>
              {priceFmt(view[vn - 1].c)}
            </span>
            <span className="tabular-nums text-[12px]" style={{ fontFamily: SANS, color: totalUp ? UP : DOWN }}>
              {totalUp ? '+' : '−'}
              {Math.abs(totalPct).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-foreground/[0.04] p-0.5">
          {TIMEFRAMES.map((tf) => {
            const on = tf === timeframe
            return (
              <button
                key={tf}
                type="button"
                aria-pressed={on}
                onClick={() => { setTimeframe(tf); setVisible(TF_COUNT[tf]); setHover(null) }}
                className={`relative rounded-full px-2.5 py-1 text-[10px] tracking-[0.06em] transition-colors duration-200 ${
                  on ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/70'
                }`}
                style={{ fontFamily: SANS }}
              >
                {on && (
                  <motion.span
                    layoutId={`cc-tf-${seed}`}
                    className="absolute inset-0 rounded-full bg-foreground/[0.08]"
                    style={{ boxShadow: 'inset 0 1px 0 0 color-mix(in srgb, var(--foreground) 6%, transparent)' }}
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{tf}</span>
              </button>
            )
          })}
        </div>
      </div>
      )}

      {/* chart — OHLC + Chg live in the crosshair tooltip only (no top strip) */}
      <div ref={plotRef} className={`relative mt-3 ${fill ? 'min-h-0 flex-1' : ''}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className={`touch-none ${fill ? 'h-full w-full' : 'w-full'}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${symbol} candlestick chart`}
        >
          {/* price gridlines + right-hand scale */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={yPrice(t)} y2={yPrice(t)} stroke="color-mix(in srgb, var(--foreground) 5%, transparent)" strokeWidth="1" />
              <text
                x={VW - 4}
                y={Math.max(9, Math.min(plotH - 2, yPrice(t) + 3))}
                textAnchor="end"
                fill="color-mix(in srgb, var(--foreground) 28%, transparent)"
                style={{ fontFamily: SANS, fontSize: 8.5 }}
              >
                {axisFmt(t)}
              </text>
            </g>
          ))}

          {/* last-close guide */}
          <line
            x1={0}
            x2={plotW}
            y1={yPrice(view[vn - 1].c)}
            y2={yPrice(view[vn - 1].c)}
            stroke={UP}
            strokeOpacity="0.4"
            strokeDasharray="2 4"
            strokeWidth="1"
          />

          {/* candles — wick + body, direction is the only hue */}
          <motion.g
            initial={reduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, ease: EASE }}
          >
            {kind === 'line' ? (
              <>
                <path
                  d={view.map((k, i) => `${i ? 'L' : 'M'}${xMid(i).toFixed(1)} ${yPrice(k.c).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={totalUp ? UP : DOWN}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={`${view.map((k, i) => `${i ? 'L' : 'M'}${xMid(i).toFixed(1)} ${yPrice(k.c).toFixed(1)}`).join(' ')} L${xMid(vn - 1).toFixed(1)} ${plotH} L${xMid(0).toFixed(1)} ${plotH} Z`}
                  fill={totalUp ? UP : DOWN}
                  opacity={0.07}
                />
              </>
            ) : (
              view.map((k, i) => {
                const color = k.c >= k.o ? UP : DOWN
                const top = yPrice(Math.max(k.o, k.c))
                const bottom = yPrice(Math.min(k.o, k.c))
                const dim = hover !== null && hover !== i
                return (
                  <g key={i} style={{ opacity: dim ? 0.45 : 1 }}>
                    <line
                      x1={xMid(i)}
                      x2={xMid(i)}
                      y1={yPrice(k.h)}
                      y2={yPrice(k.l)}
                      stroke={color}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    {kind === 'bars' ? (
                      <>
                        {/* OHLC ticks: open to the left, close to the right */}
                        <line x1={xMid(i) - bodyW / 2} x2={xMid(i)} y1={yPrice(k.o)} y2={yPrice(k.o)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1={xMid(i)} x2={xMid(i) + bodyW / 2} y1={yPrice(k.c)} y2={yPrice(k.c)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      </>
                    ) : (
                      <rect x={xMid(i) - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bottom - top)} fill={color} />
                    )}
                  </g>
                )
              })
            )}
          </motion.g>

          {/* volume strip */}
          <g transform={`translate(0 ${plotH + GAP})`}>
            {view.map((k, i) => {
              const h = (k.v / maxVolume) * volH
              const dim = hover !== null && hover !== i
              return (
                <rect
                  key={i}
                  x={xMid(i) - bodyW / 2}
                  y={volH - h}
                  width={bodyW}
                  height={h}
                  fill={k.c >= k.o ? UP : DOWN}
                  fillOpacity={dim ? 0.3 : 0.6}
                />
              )
            })}
          </g>

          {/* crosshair — vertical + a magnet read of the hovered close on the price axis */}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={xMid(hover)} x2={xMid(hover)} y1={0} y2={VH} stroke="color-mix(in srgb, var(--foreground) 18%, transparent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={0} x2={plotW} y1={yPrice(active.c)} y2={yPrice(active.c)} stroke="color-mix(in srgb, var(--foreground) 14%, transparent)" strokeDasharray="3 3" strokeWidth="1" />
              <circle cx={xMid(hover)} cy={yPrice(active.c)} r={3} fill={up ? UP : DOWN} stroke="var(--surface)" strokeWidth={1.5} />
              <g transform={`translate(${plotW}, ${Math.max(8, Math.min(plotH - 8, yPrice(active.c))) - 8})`}>
                <rect x={0} y={0} width={AXIS_W - 2} height={16} rx={3} fill="var(--surface)" stroke={up ? UP : DOWN} strokeOpacity={0.7} />
                <text x={4} y={11} fontSize={8.5} fontWeight={600} fill={up ? UP : DOWN} style={{ fontFamily: SANS }} className="tabular-nums">
                  {axisFmt(active.c)}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* price-axis zone — scroll OR drag vertically over the numbers to zoom
            the price scale (pointer-captured, like the other handles) */}
        <div
          ref={axisZoneRef}
          aria-hidden
          className="absolute inset-y-0 right-0 z-[5] cursor-ns-resize touch-none select-none"
          style={{ width: `${(AXIS_W / VW) * 100}%` }}
          onPointerDown={(e) => {
            yDrag.current = { startY: e.clientY, startS: yScale }
            e.currentTarget.setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = yDrag.current
            if (!d) return
            const h = svgRef.current?.getBoundingClientRect().height || 300
            /* drag down = zoom out (higher ceiling), drag up = zoom in — matches the wheel */
            setYScale(Math.max(Y_SCALE_MIN, Math.min(Y_SCALE_MAX, d.startS * Math.exp(((e.clientY - d.startY) / h) * 2.2))))
          }}
          onPointerUp={() => (yDrag.current = null)}
          onPointerCancel={() => (yDrag.current = null)}
        />

        {/* left-edge width handle — drag left to grow, right to shrink.
            fill mode has no card to widen: the pane owns the width. */}
        {!fill && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chart width"
          aria-valuenow={Math.round(width ?? 600)}
          aria-valuemin={MIN_W}
          aria-valuemax={MAX_W}
          tabIndex={0}
          className="group absolute -left-2 inset-y-0 z-10 flex w-3 cursor-ew-resize touch-none select-none items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
          onPointerDown={(e) => {
            const el = rootRef.current
            widthDrag.current = {
              startX: e.clientX,
              startW: el?.getBoundingClientRect().width ?? 600,
              max: Math.min(MAX_W, el?.parentElement?.clientWidth || MAX_W),
            }
            e.currentTarget.setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = widthDrag.current
            if (!d) return
            setWidth(Math.round(Math.max(MIN_W, Math.min(d.max, d.startW + (d.startX - e.clientX)))))
          }}
          onPointerUp={() => (widthDrag.current = null)}
          onPointerCancel={() => (widthDrag.current = null)}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowLeft' ? 16 : e.key === 'ArrowRight' ? -16 : 0
            if (!step) return
            e.preventDefault()
            setWidth((w) => {
              const cur = w ?? rootRef.current?.getBoundingClientRect().width ?? 600
              return Math.round(Math.max(MIN_W, Math.min(MAX_W, cur + step)))
            })
          }}
        >
          <span className="h-9 w-[3px] rounded-full bg-foreground/[0.14] transition-colors duration-200 group-hover:bg-foreground/35" />
        </div>
        )}

        {/* price/volume divider — drag up for a taller volume pane */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize volume pane"
          aria-valuenow={Math.round(volH)}
          aria-valuemin={MIN_VOL}
          aria-valuemax={MAX_VOL}
          tabIndex={0}
          className="group absolute inset-x-0 z-10 flex h-3 -translate-y-1/2 cursor-ns-resize touch-none select-none items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
          style={{ top: `${((plotH + GAP / 2) / VH) * 100}%` }}
          onPointerDown={(e) => {
            volDrag.current = true
            e.currentTarget.setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!volDrag.current) return
            const r = svgRef.current?.getBoundingClientRect()
            if (!r) return
            const vy = ((e.clientY - r.top) / r.height) * VH
            setVolH(Math.max(MIN_VOL, Math.min(MAX_VOL, VH - vy - GAP / 2)))
          }}
          onPointerUp={() => (volDrag.current = false)}
          onPointerCancel={() => (volDrag.current = false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); setVolH((v) => Math.min(MAX_VOL, v + 8)) }
            if (e.key === 'ArrowDown') { e.preventDefault(); setVolH((v) => Math.max(MIN_VOL, v - 8)) }
          }}
        >
          {/* thumb hidden until the divider is hovered / keyboard-focused */}
          <span className="h-[3px] w-8 rounded-full bg-foreground/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
        </div>

        {/* crosshair tooltip */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[130px] rounded-lg border border-foreground/[0.03] px-3 py-2.5"
            style={{
              background: 'var(--surface)',
              boxShadow: 'inset 0 1px 0 0 color-mix(in srgb, var(--foreground) 6%, transparent), 0 12px 32px rgba(0,0,0,0.5)',
              left: `${(xMid(hover) / VW) * 100}%`,
              transform: tipLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
            role="status"
          >
            <div className="text-[9px] text-foreground/45" style={{ fontFamily: SANS }}>
              {fmtStamp(active.t)}
            </div>
            {zone === 'volume' ? (
              /* volume pane read — bar height / tallest visible bar, in relative units */
              <div className="mt-1.5 flex items-center justify-between gap-4">
                <span className="text-[9px] text-foreground/40">Volume</span>
                <span className="tabular-nums text-[11px] text-foreground/85" style={{ fontFamily: SANS }}>
                  {active.v.toFixed(1)}M
                </span>
              </div>
            ) : (
              <div className="mt-1.5 flex flex-col gap-1">
                {(['o', 'h', 'l', 'c'] as const).map((key, idx) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-[9px] text-foreground/40">{['Open', 'High', 'Low', 'Close'][idx]}</span>
                    <span className="tabular-nums text-[11px] text-foreground/85" style={{ fontFamily: SANS }}>
                      {priceFmt(active[key])}
                    </span>
                  </div>
                ))}
                {/* Chg = (Close − Open) / Open — the one hue-carrying number */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[9px] text-foreground/40">Chg</span>
                  <span className="tabular-nums text-[11px]" style={{ fontFamily: SANS, color: up ? UP : DOWN }}>
                    {up ? '+' : '−'}{Math.abs(changePct).toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* date axis — scroll sideways (or vertically) here to change how much chart is visible */}
      <div ref={dateAxisRef} className="mt-2 flex shrink-0 cursor-ew-resize touch-none select-none justify-between border-t border-foreground/[0.04] pr-[46px] pt-2">
        {dateLabels.map((k, i) => (
          <span key={i} className="tabular-nums text-[9px] text-foreground/30" style={{ fontFamily: SANS }}>
            {fmtDay(k.t)}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Demo() {
  return (
    <div className="flex min-h-[420px] w-full items-center justify-center p-6">
      <CandleChart />
    </div>
  )
}

export { CandleChart as Component }
