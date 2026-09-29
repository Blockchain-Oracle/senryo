import { useMemo, useState } from 'react'
import { ChevronDown as CaretDown, ChevronUp as CaretUp } from 'lucide-react'

const ACCENT: [number, number, number] = [72, 159, 250]
const CHART = { blue: 'var(--chart-1, #489ffa)', green: 'var(--chart-2, #4dbe95)', amber: 'var(--chart-3, #c27c58)', yellow: 'var(--chart-4, #e9ec89)', purple: 'var(--chart-5, #c88fcf)' } as const
const HAIRLINE = 'color-mix(in srgb, var(--foreground) 5.5%, transparent)'
const SANS = 'inherit'
const SURFACE = 'var(--card)'
const TEXT = 'var(--foreground)'
const TEXT_MUTED = 'var(--muted-foreground)'
const accentRgba = (a: number, c: [number, number, number] = ACCENT) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

export type Asset = { symbol: string; name: string; price: number; change: number; points: number[] }

const ASSETS: Asset[] = [
  { symbol: 'NVDA', name: 'NVIDIA', price: 136.24, change: 3.82, points: [3, 5, 4, 8, 7, 12, 11, 15] },
  { symbol: 'AMZN', name: 'Amazon', price: 178.52, change: 1.46, points: [4, 4, 6, 5, 8, 7, 10, 12] },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: 604.21, change: 0.48, points: [6, 7, 6, 8, 9, 8, 10, 11] },
  { symbol: 'AAPL', name: 'Apple', price: 212.33, change: -0.72, points: [12, 11, 13, 10, 9, 10, 8, 7] },
  { symbol: 'VIX', name: 'Volatility', price: 14.88, change: -2.14, points: [14, 13, 15, 12, 11, 9, 10, 7] },
]

function Sparkline({ asset }: { asset: Asset }) {
  const max = Math.max(...asset.points)
  const min = Math.min(...asset.points)
  const path = asset.points.map((value, index) => {
    const x = 2 + (index / (asset.points.length - 1)) * 76
    const y = 3 + (1 - (value - min) / (max - min || 1)) * 23
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return <svg viewBox="0 0 80 30" className="h-7 w-20" aria-hidden><path d={path} fill="none" stroke={asset.change >= 0 ? CHART.green : 'var(--chart-down, #e06a6a)'} strokeWidth="1.5" strokeLinecap="round" /></svg>
}

export default function MarketWatchlist({ assets = ASSETS, title = 'Market watchlist', className = '', initial = 'NVDA' }: { assets?: Asset[]; title?: string; className?: string; initial?: string } = {}) {
  const [sort, setSort] = useState<'symbol' | 'change'>('change')
  const [descending, setDescending] = useState(true)
  const [active, setActive] = useState(initial)

  const rows = useMemo(() => [...assets].sort((a, b) => {
    const result = sort === 'change' ? a.change - b.change : a.symbol.localeCompare(b.symbol)
    return descending ? -result : result
  }), [sort, descending, assets])

  const changeSort = (next: 'symbol' | 'change') => {
    if (sort === next) setDescending((value) => !value)
    else { setSort(next); setDescending(next === 'change') }
  }

  return (
    <div className={`w-full max-w-[540px] overflow-hidden rounded-lg border ${className}`} style={{ background: SURFACE, borderColor: HAIRLINE, fontFamily: SANS }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: HAIRLINE }}><h3 className="text-[13px] font-semibold" style={{ color: TEXT }}>{title}</h3><span className="text-[10px]" style={{ color: TEXT_MUTED }}>{assets.length} assets</span></div>
      <div className="grid grid-cols-[minmax(0,1fr)_80px_92px] items-center border-b px-5 py-2 text-[10px] font-normal tracking-[0.07em]" style={{ borderColor: HAIRLINE, color: TEXT_MUTED }}>
        <button type="button" onClick={() => changeSort('symbol')} className="flex items-center gap-1 text-left">Asset {sort === 'symbol' && (descending ? <CaretDown size={10} /> : <CaretUp size={10} />)}</button>
        <span className="text-center">Trend</span>
        <button type="button" onClick={() => changeSort('change')} className="flex items-center justify-end gap-1">Change {sort === 'change' && (descending ? <CaretDown size={10} /> : <CaretUp size={10} />)}</button>
      </div>
      {rows.map((asset) => {
        const selected = active === asset.symbol
        const positive = asset.change >= 0
        return (
          <button key={asset.symbol} type="button" onClick={() => setActive(asset.symbol)} className="grid w-full grid-cols-[minmax(0,1fr)_80px_92px] items-center border-b px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.025]" style={{ borderColor: HAIRLINE, background: selected ? accentRgba(0.045) : undefined }}>
            <span className="flex min-w-0 items-center gap-3"><span className="h-4 w-[2px] shrink-0 rounded-full" style={{ background: selected ? CHART.blue : 'color-mix(in srgb, var(--foreground) 12%, transparent)' }} /><span className="min-w-0"><span className="block text-[12px] font-semibold" style={{ color: TEXT }}>{asset.symbol}</span><span className="block truncate text-[10px]" style={{ color: TEXT_MUTED }}>{asset.name}</span></span></span>
            <Sparkline asset={asset} />
            <span className="text-right tabular-nums"><span className="block text-[12px] font-semibold" style={{ color: TEXT }}>${asset.price < 10 ? asset.price.toFixed(4) : asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span className="text-[10px] font-semibold" style={{ color: positive ? CHART.green : 'var(--chart-down, #e06a6a)' }}>{positive ? '+' : ''}{asset.change.toFixed(2)}%</span></span>
          </button>
        )
      })}
    </div>
  )
}

export function Demo() { return <div className="flex min-h-[460px] w-full items-center justify-center p-3"><MarketWatchlist /></div> }

export { MarketWatchlist as Component }
