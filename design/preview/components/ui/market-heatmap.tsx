"use client"

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/** Market Heatmap — the Finviz money shot as one self-contained SVG: tiles are
 *  **sized by market cap** through a hand-rolled squarified treemap, and
 *  **colored on a diverging red↔green scale by % change**, so magnitude and
 *  direction read before you parse a single label. Hovering a tile dims the rest
 *  of the map and opens a readout with price, change and cap — parked BESIDE the
 *  tile, never on top of it, so even the smallest tile stays visible while you
 *  read it. Clicking pins that tile: a dashed outline holds the readout open so
 *  the pointer is free to leave, and clicking again releases the map.
 *  Deterministic layout — same input, same map. Light and dark via shadcn
 *  tokens; respects reduced motion. */

const GREEN = 'var(--chart-2, #22c55e)'
const RED = 'var(--chart-down, #ef5350)'
/** A hue as TEXT: 60% hue, 40% foreground, so coloured figures clear 4.5:1 on any shadcn theme.
 *  Tiles and outlines keep the pure hue. */
const ink = (c: string) => `color-mix(in oklab, ${c} 60%, var(--foreground))`
const SURFACE = 'var(--surface, var(--card))'
const HAIRLINE = 'var(--border)'
const TEXT = 'var(--foreground)'
const TEXT_MUTED = 'var(--muted-foreground)'

export type Company = {
  sym: string
  name: string
  /** market cap in trillions — drives the tile's area */
  cap: number
  /** % change today — drives the tile's color */
  chg: number
  price: number
}

const DATA: Company[] = [
  { sym: 'AAPL', name: 'Apple', cap: 3.4, chg: 0.8, price: 228.5 },
  { sym: 'MSFT', name: 'Microsoft', cap: 3.1, chg: 1.2, price: 441.2 },
  { sym: 'NVDA', name: 'NVIDIA', cap: 2.9, chg: 3.1, price: 179.8 },
  { sym: 'GOOGL', name: 'Alphabet', cap: 2.1, chg: -0.6, price: 182.4 },
  { sym: 'AMZN', name: 'Amazon', cap: 1.9, chg: 1.5, price: 201.3 },
  { sym: 'META', name: 'Meta', cap: 1.3, chg: -1.2, price: 512.7 },
  { sym: 'AVGO', name: 'Broadcom', cap: 0.8, chg: 2.2, price: 168.1 },
  { sym: 'TSLA', name: 'Tesla', cap: 0.78, chg: -2.4, price: 244.9 },
  { sym: 'JPM', name: 'JPMorgan', cap: 0.62, chg: 0.3, price: 214.6 },
  { sym: 'V', name: 'Visa', cap: 0.55, chg: 0.1, price: 289.0 },
  { sym: 'WMT', name: 'Walmart', cap: 0.5, chg: -0.4, price: 69.4 },
  { sym: 'XOM', name: 'Exxon', cap: 0.48, chg: -1.1, price: 118.2 },
  { sym: 'UNH', name: 'UnitedHealth', cap: 0.45, chg: 0.9, price: 528.3 },
  { sym: 'MA', name: 'Mastercard', cap: 0.42, chg: 0.2, price: 471.5 },
  { sym: 'HD', name: 'Home Depot', cap: 0.38, chg: -0.7, price: 361.8 },
  { sym: 'PG', name: 'P&G', cap: 0.35, chg: 0.5, price: 167.9 },
]

const W = 460
const H = 280

type Tile = { x: number; y: number; w: number; h: number; co: Company }

/** aspect-ratio cost of a row — the squarify heuristic */
function worst(row: number[], side: number, area: number) {
  const max = Math.max(...row)
  const min = Math.min(...row)
  const s2 = area * area
  const l2 = side * side
  return Math.max((l2 * max) / s2, s2 / (l2 * min))
}

/** squarified treemap — areas scaled to fill w×h, rows laid along the short side */
function squarify(cos: Company[], w = W, h = H): Tile[] {
  const total = cos.reduce((s, c) => s + c.cap, 0)
  const scale = (w * h) / total
  const items = cos.map((c) => ({ area: c.cap * scale, co: c }))
  const out: Tile[] = []
  let rx = 0
  let ry = 0
  let rw = w
  let rh = h
  let idx = 0
  while (idx < items.length) {
    const side = Math.min(rw, rh)
    const row = [items[idx].area]
    const rowCos = [items[idx].co]
    let rowArea = items[idx].area
    let k = idx + 1
    while (k < items.length) {
      const nxt = rowArea + items[k].area
      if (worst([...row, items[k].area], side, nxt) > worst(row, side, rowArea)) break
      row.push(items[k].area)
      rowCos.push(items[k].co)
      rowArea = nxt
      k++
    }
    if (rw >= rh) {
      const colW = rowArea / rh
      let cy = ry
      row.forEach((a, j) => {
        const th = a / colW
        out.push({ x: rx, y: cy, w: colW, h: th, co: rowCos[j] })
        cy += th
      })
      rx += colW
      rw -= colW
    } else {
      const rowH = rowArea / rw
      let cxx = rx
      row.forEach((a, j) => {
        const tw = a / rowH
        out.push({ x: cxx, y: ry, w: tw, h: rowH, co: rowCos[j] })
        cxx += tw
      })
      ry += rowH
      rh -= rowH
    }
    idx = k
  }
  return out
}

/** diverging scale — the hue says direction, its saturation says magnitude */
const tileFill = (chg: number) =>
  `color-mix(in srgb, ${chg >= 0 ? GREEN : RED} ${Math.round(Math.min(Math.abs(chg) / 3, 1) * 48 + 9)}%, var(--card))`

const TIP_W = 140
const TIP_GAP = 8

/** Park the readout clear of the tile it describes — a centered box would sit
 *  completely on top of the small tiles. Try above, then below, then either
 *  side, and clamp to the chart box so nothing overflows or gets clipped. */
function place(t: Tile, h: number, mapW = W, mapH = H) {
  const cx = Math.max(0, Math.min(mapW - TIP_W, t.x + t.w / 2 - TIP_W / 2))
  const cy = Math.max(0, Math.min(mapH - h, t.y + t.h / 2 - h / 2))
  const above = t.y - TIP_GAP - h
  if (above >= 0) return { left: cx, top: above }
  const below = t.y + t.h + TIP_GAP
  if (below + h <= mapH) return { left: cx, top: below }
  const right = t.x + t.w + TIP_GAP
  if (right + TIP_W <= mapW) return { left: right, top: cy }
  const left = t.x - TIP_GAP - TIP_W
  if (left >= 0) return { left, top: cy }
  // a tile that big leaves nowhere beside it — take the far corner from it
  return { left: t.x < mapW / 2 ? mapW - TIP_W : 0, top: t.y < mapH / 2 ? mapH - h : 0 }
}

export default function MarketHeatmap({
  data = DATA,
  title = 'Market map · today',
  className = '',
}: {
  /** tiles to lay out — sized by `cap`, colored by `chg` */
  data?: Company[]
  title?: string
  className?: string
}) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  const [pin, setPin] = useState<string | null>(null)
  /** a pinned tile outranks the pointer — the readout stays put once you click */
  const hot = pin ?? hover
  /* Narrower than 460px, the map re-lays itself to the width it gets rather than
     overflowing or scaling its labels down: tiles reflow, type stays at size. */
  const boxRef = useRef<HTMLDivElement>(null)
  const [mapW, setMapW] = useState(W)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setMapW(Math.max(200, Math.min(W, Math.round(e.contentRect.width)))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const mapH = Math.round((H * mapW) / W)
  const tiles = useMemo(() => squarify([...data].sort((a, b) => b.cap - a.cap), mapW, mapH), [data, mapW, mapH])
  const hotTile = tiles.find((t) => t.co.sym === hot)

  // the readout is a fixed four-line block, but measure it anyway so the
  // above/below flip is decided on its real height at any type scale
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipH, setTipH] = useState(62)
  useLayoutEffect(() => {
    const el = tipRef.current
    if (el) setTipH(el.offsetHeight)
  }, [hot])
  const tip = hotTile ? place(hotTile, tipH, mapW, mapH) : null

  return (
    <div className={`w-[460px] max-w-full ${className}`}>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <span className="text-[13px] font-medium" style={{ color: TEXT }}>
          {title}
        </span>
        <span className="text-[10px]" style={{ color: TEXT_MUTED }}>
          sized by market cap
        </span>
      </div>

      {/* The map takes focus: the arrows walk the tiles from largest to smallest, Enter
          pins the readout, Escape lets go. A tap reads a tile the way a hover does. */}
      <div
        ref={boxRef}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="group"
        aria-label={`${title}. Use the arrow keys to read each company, Enter to pin it.`}
        onFocus={() => setHover((h) => h ?? pin ?? tiles[0]?.co.sym ?? null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          const at = tiles.findIndex((t) => t.co.sym === hot)
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
          if (step) {
            e.preventDefault()
            setPin(null)
            setHover(tiles[(at + step + tiles.length) % tiles.length].co.sym)
          } else if ((e.key === 'Enter' || e.key === ' ') && hot) {
            e.preventDefault()
            setPin((p) => (p === hot ? null : hot))
          } else if (e.key === 'Escape') {
            setPin(null)
            setHover(null)
          }
        }}
      >
        <svg
          width={mapW}
          height={mapH}
          viewBox={`0 0 ${mapW} ${mapH}`}
          role="img"
          aria-label={`${title}, ${tiles.length} companies sized by market cap`}
          className="block overflow-visible rounded-lg"
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null)
          }}
        >
          {tiles.map((t, i) => {
            const on = hot === t.co.sym
            const pinned = pin === t.co.sym
            const dim = hot !== null && !on
            const big = t.w > 52 && t.h > 30
            return (
              <motion.g
                key={t.co.sym}
                onPointerEnter={() => { if (!pin) setHover(t.co.sym) }}
                onClick={() => setPin((p) => (p === t.co.sym ? null : t.co.sym))}
                style={{ cursor: 'pointer' }}
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: dim ? 0.5 : 1 }}
                transition={reduced ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: i * 0.02 }}
              >
                <rect
                  x={t.x + 0.5}
                  y={t.y + 0.5}
                  width={Math.max(0, t.w - 1)}
                  height={Math.max(0, t.h - 1)}
                  rx={2}
                  fill={tileFill(t.co.chg)}
                  stroke={on ? (t.co.chg >= 0 ? GREEN : RED) : 'color-mix(in srgb, var(--foreground) 10%, transparent)'}
                  strokeWidth={pinned ? 2 : on ? 1.5 : 1}
                  strokeDasharray={pinned ? '3 2' : undefined}
                />
                {big && (
                  <>
                    <text x={t.x + 6} y={t.y + 16} fontSize={11} fontWeight={700} fill={TEXT}>
                      {t.co.sym}
                    </text>
                    <text
                      x={t.x + 6}
                      y={t.y + 28}
                      fontSize={9}
                      fontWeight={600}
                      fill="color-mix(in srgb, var(--foreground) 90%, transparent)"
                      className="tabular-nums"
                    >
                      {t.co.chg >= 0 ? '+' : '−'}
                      {Math.abs(t.co.chg).toFixed(1)}%
                    </text>
                  </>
                )}
                {!big && t.w > 26 && (
                  <text
                    x={t.x + t.w / 2}
                    y={t.y + t.h / 2 + 3}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontWeight={600}
                    fill="color-mix(in srgb, var(--foreground) 70%, transparent)"
                  >
                    {t.co.sym}
                  </text>
                )}
              </motion.g>
            )
          })}
        </svg>

        {/* readout — never over the tile it describes, never outside the map */}
        {hotTile && tip && (
          <div
            ref={tipRef}
            role="status"
            className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5"
            style={{
              background: SURFACE,
              borderColor: HAIRLINE,
              width: `${TIP_W}px`,
              left: `${tip.left}px`,
              top: `${tip.top}px`,
            }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold" style={{ color: TEXT }}>
                {hotTile.co.sym}
              </span>
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: ink(hotTile.co.chg >= 0 ? GREEN : RED) }}
              >
                {hotTile.co.chg >= 0 ? '+' : '−'}
                {Math.abs(hotTile.co.chg).toFixed(2)}%
              </span>
            </div>
            <div className="mt-0.5 text-[9.5px]" style={{ color: TEXT_MUTED }}>
              {hotTile.co.name}
            </div>
            <div className="mt-1 flex justify-between text-[9.5px] tabular-nums" style={{ color: TEXT_MUTED }}>
              <span>${hotTile.co.price.toFixed(2)}</span>
              <span>${hotTile.co.cap.toFixed(2)}T</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Demo() {
  return (
    <div className="flex min-h-[340px] w-full items-center justify-center p-6">
      <MarketHeatmap />
    </div>
  )
}
