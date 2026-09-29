import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const CHART = { blue: 'var(--chart-1, #489ffa)', green: 'var(--chart-2, #4dbe95)', amber: 'var(--chart-3, #c27c58)', yellow: 'var(--chart-4, #e9ec89)', purple: 'var(--chart-5, #c88fcf)' } as const
const EASE = [0.16, 1, 0.3, 1] as const
const HAIRLINE = 'color-mix(in srgb, var(--foreground) 5.5%, transparent)'
const SANS = 'inherit'
const SURFACE = 'var(--card)'
const TEXT = 'var(--foreground)'
const TEXT_MUTED = 'var(--muted-foreground)'

const PERIODS = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'All']
const VALUES = [178.52, 176.84, 180.15, 181.42, 179.96, 184.22, 187.61, 190.04, 188.72, 194.85, 202.14, 198.93, 211.75, 224.68, 219.42, 236.18, 248.06, 243.44, 268.31, 284.12, 276.88, 301.45]
const W = 320
const H = 150

export default function MarketSnapshotCard({ name = 'Amazon.com Inc.', symbol = 'AMZN', values = VALUES, venue = 'NASDAQ · USD', updated = 'Updated 1:54 PM', className = '', fmt = (n: number) => `$${n.toFixed(2)}` }: { name?: string; symbol?: string; values?: number[]; venue?: string; updated?: string; className?: string; fmt?: (n: number) => string } = {}) {
  const VALUES_ = values
  const reduced = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const [period, setPeriod] = useState('All')
  const [hover, setHover] = useState<number | null>(null)

  const factor = Math.max(7, Math.round(VALUES_.length * ((PERIODS.indexOf(period) + 1) / PERIODS.length)))
  const data = useMemo(() => VALUES_.slice(-factor), [factor, VALUES_])
  const min = Math.min(...data) * 0.97
  const max = Math.max(...data) * 1.02
  const x = (i: number) => 8 + (i / (data.length - 1)) * (W - 16)
  const y = (v: number) => 8 + (1 - (v - min) / (max - min || 1)) * (H - 18)
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const active = hover == null ? data.length - 1 : hover
  const price = data[active]
  const delta = price - data[0]
  const pct = (delta / data[0]) * 100

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((event.clientX - bounds.left) / bounds.width) * (data.length - 1)))))
  }

  // date under the cursor — fixed "now" anchor so every render reads the same
  const WINDOW_DAYS: Record<string, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, YTD: 210, '1Y': 365, All: 660 }
  const hoverStamp = (i: number) => {
    const end = new Date(2026, 6, 29, 16, 0)
    const backDays = ((data.length - 1 - i) / (data.length - 1)) * (WINDOW_DAYS[period] ?? 660)
    const d = new Date(end.getTime() - backDays * 86400000)
    return period === '1D'
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: period === 'All' || period === '1Y' ? '2-digit' : undefined })
  }

  return (
    <div className={`w-full max-w-[340px] overflow-hidden rounded-lg border ${className}`} style={{ background: SURFACE, borderColor: HAIRLINE, fontFamily: SANS }}>
      <div className="flex items-start justify-between px-5 pb-2 pt-5">
        <div>
          <p className="text-[11px] font-medium" style={{ color: TEXT_MUTED }}>{name}</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={price.toFixed(2)} className="text-[22px] font-semibold tracking-[-0.035em]" style={{ color: TEXT }} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                {fmt(price)}
              </motion.span>
            </AnimatePresence>
            <span className="text-[11px] font-semibold" style={{ color: delta >= 0 ? CHART.green : 'var(--chart-down)' }}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
          </div>
        </div>
        <span className="text-[12px] font-semibold" style={{ color: TEXT }}>{symbol}</span>
      </div>

      <div className="relative px-3">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`${name} price ${price.toFixed(2)} dollars over ${period}`}>
          {[0.33, 0.66].map((p) => <line key={p} x1="8" x2={W - 8} y1={8 + p * (H - 18)} y2={8 + p * (H - 18)} stroke={HAIRLINE} strokeDasharray="2 5" />)}
          <motion.path key={period} d={path} fill="none" stroke={CHART.green} strokeWidth="1.8" strokeLinecap="round" initial={reduced ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.65, ease: EASE }} />
          {hover != null && <><line x1={x(active)} x2={x(active)} y1="8" y2={H - 10} stroke="color-mix(in srgb, var(--foreground) 16%, transparent)" /><circle cx={x(active)} cy={y(price)} r="3" fill={CHART.green} stroke={SURFACE} strokeWidth="1.5" /></>}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[9px] tabular-nums"
            style={{
              left: `${((x(active) / W) * 100).toFixed(1)}%`,
              background: SURFACE,
              borderColor: HAIRLINE,
              color: TEXT_MUTED,
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            }}
            role="status"
          >
            {hoverStamp(active)}
          </div>
        )}
      </div>

      <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: HAIRLINE }}>
        <div className="flex items-center justify-between gap-1">
          {PERIODS.map((item) => {
            const activePeriod = item === period
            return (
              <button key={item} type="button" onClick={() => { setPeriod(item); setHover(null) }} className="relative rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors" style={{ color: activePeriod ? TEXT : TEXT_MUTED, background: activePeriod ? 'color-mix(in srgb, var(--foreground) 5.5%, transparent)' : 'transparent' }}>
                {item}
                {activePeriod && (
                  <motion.span
                    layoutId="msnap-period-tab"
                    className="absolute inset-x-1.5 -bottom-[5px] h-[3px] rounded-t-full"
                    style={{ background: CHART.green }}
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] tabular-nums" style={{ color: TEXT_MUTED }}>
          <span>{updated}</span><span>{venue}</span>
        </div>
      </div>
    </div>
  )
}

export function Demo() {
  return <div className="flex min-h-[420px] w-full items-center justify-center p-4"><MarketSnapshotCard /></div>
}

export { MarketSnapshotCard as Component }
