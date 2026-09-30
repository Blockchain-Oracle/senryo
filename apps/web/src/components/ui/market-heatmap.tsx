"use client";

// 21st: ssychui/market-heatmap (#30551) — https://21st.dev/@ssychui/components/market-heatmap
// Squarified treemap sized by `cap`, diverging red↔green by `chg`. Re-tokenized for D2 Desk: fluid width (no 460 cap,
// no zoom hack), D2 type sizes, stagger on ease-desk, hues from --chart-up/--chart-down. Data-driven (no demo inside).

import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DESK_BASE_S, deskTransition } from "@/lib/constants/charts";
import { cn } from "@/lib/utils";

export type HeatTile = {
  sym: string;
  name: string;
  /** drives the tile's area (market cap, open interest…) */
  cap: number;
  /** % change — drives the tile's colour */
  chg: number;
  price: number;
};

export interface MarketHeatmapProps {
  data: readonly HeatTile[];
  title?: string;
  subtitle?: string;
  formatCap?: (cap: number) => string;
  formatPrice?: (price: number) => string;
  /** height ÷ width of the map */
  aspect?: number;
  className?: string;
}

const UP = "var(--chart-up)";
const DOWN = "var(--chart-down)";
const TILE_EDGE = "color-mix(in srgb, var(--foreground) 10%, transparent)";
const ink = (c: string) => `color-mix(in oklab, ${c} 60%, var(--foreground))`;
/** 280 ÷ 460, the source map’s proportions */
const DEFAULT_ASPECT = 0.6087;
const HALF_PX = 0.5;
const STROKE_PINNED = 2;
const STROKE_ON = 1.5;
const INITIAL_W = 460;
const MIN_W = 200;
const TIP_W = 140;
const TIP_GAP = 8;
const TIP_H0 = 62;
const HALF = 2;
const SAT_MAX_PCT = 3;
const SAT_RANGE = 48;
const SAT_FLOOR = 9;
const BIG_W = 52;
const BIG_H = 30;
const LABEL_MIN_W = 26;
const LABEL_X = 6;
const SYM_Y = 16;
const CHG_Y = 28;
const SMALL_BASELINE = 3;
const SYM_FONT = 10;
const CHG_FONT = 9;
const SMALL_FONT = 8;
const STAGGER_S = 0.02;
const DIM = 0.5;
const DP = 2;

type Tile = { x: number; y: number; w: number; h: number; co: HeatTile };

/** aspect-ratio cost of a row — the squarify heuristic */
function worst(row: readonly number[], side: number, area: number) {
  const s2 = area * area;
  const l2 = side * side;
  return Math.max((l2 * Math.max(...row)) / s2, s2 / (l2 * Math.min(...row)));
}

/** squarified treemap — areas scaled to fill w×h, rows laid along the short side */
function squarify(cos: readonly HeatTile[], w: number, h: number): Tile[] {
  const total = cos.reduce((s, c) => s + c.cap, 0) || 1;
  const items = cos.map((co) => ({ area: (co.cap * w * h) / total, co }));
  const out: Tile[] = [];
  let [rx, ry, rw, rh] = [0, 0, w, h];
  let idx = 0;
  while (idx < items.length) {
    const side = Math.min(rw, rh);
    const row: (typeof items)[number][] = [];
    let rowArea = 0;
    let k = idx;
    for (; k < items.length; k++) {
      const item = items[k];
      if (!item) break;
      const areas = row.map((r) => r.area);
      if (row.length && worst([...areas, item.area], side, rowArea + item.area) > worst(areas, side, rowArea)) break;
      row.push(item);
      rowArea += item.area;
    }
    if (rw >= rh) {
      const colW = rowArea / rh;
      let cy = ry;
      for (const r of row) {
        out.push({ x: rx, y: cy, w: colW, h: r.area / colW, co: r.co });
        cy += r.area / colW;
      }
      rx += colW;
      rw -= colW;
    } else {
      const rowH = rowArea / rw;
      let cx = rx;
      for (const r of row) {
        out.push({ x: cx, y: ry, w: r.area / rowH, h: rowH, co: r.co });
        cx += r.area / rowH;
      }
      ry += rowH;
      rh -= rowH;
    }
    idx = Math.max(k, idx + 1);
  }
  return out;
}

/** hue says direction, saturation says magnitude */
const tileFill = (chg: number) =>
  `color-mix(in srgb, ${chg >= 0 ? UP : DOWN} ${Math.round(Math.min(Math.abs(chg) / SAT_MAX_PCT, 1) * SAT_RANGE + SAT_FLOOR)}%, var(--card))`;

/** Park the readout beside the tile (above → below → right → left → far corner), clamped to the map. */
function place(t: Tile, h: number, mapW: number, mapH: number) {
  const cx = Math.max(0, Math.min(mapW - TIP_W, t.x + t.w / HALF - TIP_W / HALF));
  const cy = Math.max(0, Math.min(mapH - h, t.y + t.h / HALF - h / HALF));
  const above = t.y - TIP_GAP - h;
  if (above >= 0) return { left: cx, top: above };
  const below = t.y + t.h + TIP_GAP;
  if (below + h <= mapH) return { left: cx, top: below };
  const right = t.x + t.w + TIP_GAP;
  if (right + TIP_W <= mapW) return { left: right, top: cy };
  const left = t.x - TIP_GAP - TIP_W;
  if (left >= 0) return { left, top: cy };
  return { left: t.x < mapW / HALF ? mapW - TIP_W : 0, top: t.y < mapH / HALF ? mapH - h : 0 };
}

const signed = (n: number, dp: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(dp)}%`;

export default function MarketHeatmap({
  data,
  title = "Market map · today",
  subtitle = "sized by market cap",
  formatCap = (c) => `$${c.toFixed(DP)}T`,
  formatPrice = (p) => `$${p.toFixed(DP)}`,
  aspect = DEFAULT_ASPECT,
  className,
}: MarketHeatmapProps) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const hot = pin ?? hover;
  const boxRef = useRef<HTMLDivElement>(null);
  const [mapW, setMapW] = useState(INITIAL_W);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setMapW(Math.max(MIN_W, Math.round(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mapH = Math.round(mapW * aspect);
  const tiles = useMemo(
    () =>
      squarify(
        [...data].sort((a, b) => b.cap - a.cap),
        mapW,
        mapH,
      ),
    [data, mapW, mapH],
  );
  const hotTile = tiles.find((t) => t.co.sym === hot);

  const tipRef = useRef<HTMLDivElement>(null);
  const [tipH, setTipH] = useState(TIP_H0);
  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  }, [hot]);
  const tip = hotTile ? place(hotTile, tipH, mapW, mapH) : null;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <span className="text-caption font-medium text-foreground">{title}</span>
        <span className="text-micro text-muted-foreground">{subtitle}</span>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a composite keyboard widget (arrows walk tiles), not a form group */}
      <div
        ref={boxRef}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys walk the tiles, Enter pins (21st behaviour)
        tabIndex={0}
        role="group"
        aria-label={`${title}. Use the arrow keys to read each market, Enter to pin it.`}
        onFocus={() => setHover((h) => h ?? pin ?? tiles[0]?.co.sym ?? null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          const at = tiles.findIndex((t) => t.co.sym === hot);
          const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
          const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
          if (fwd || back) {
            e.preventDefault();
            setPin(null);
            const next = tiles[(at + (fwd ? 1 : -1) + tiles.length) % tiles.length];
            setHover(next?.co.sym ?? null);
          } else if ((e.key === "Enter" || e.key === " ") && hot) {
            e.preventDefault();
            setPin((p) => (p === hot ? null : hot));
          } else if (e.key === "Escape") {
            setPin(null);
            setHover(null);
          }
        }}
      >
        <svg
          width={mapW}
          height={mapH}
          viewBox={`0 0 ${mapW} ${mapH}`}
          role="img"
          aria-label={`${title}, ${tiles.length} markets`}
          className="block overflow-visible rounded-lg"
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHover(null);
          }}
        >
          {tiles.map((t, i) => {
            const on = hot === t.co.sym;
            const pinned = pin === t.co.sym;
            const big = t.w > BIG_W && t.h > BIG_H;
            return (
              <motion.g
                key={t.co.sym}
                onPointerEnter={() => {
                  if (!pin) setHover(t.co.sym);
                }}
                onClick={() => setPin((p) => (p === t.co.sym ? null : t.co.sym))}
                className="cursor-pointer"
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: hot !== null && !on ? DIM : 1 }}
                transition={reduced ? { duration: 0 } : deskTransition(DESK_BASE_S, i * STAGGER_S)}
              >
                <rect
                  x={t.x + HALF_PX}
                  y={t.y + HALF_PX}
                  width={Math.max(0, t.w - 1)}
                  height={Math.max(0, t.h - 1)}
                  rx={2}
                  fill={tileFill(t.co.chg)}
                  stroke={on ? (t.co.chg >= 0 ? UP : DOWN) : TILE_EDGE}
                  strokeWidth={pinned ? STROKE_PINNED : on ? STROKE_ON : 1}
                  strokeDasharray={pinned ? "3 2" : undefined}
                />
                {big && (
                  <>
                    <text
                      x={t.x + LABEL_X}
                      y={t.y + SYM_Y}
                      fontSize={SYM_FONT}
                      fontWeight={700}
                      className="fill-foreground font-mono"
                    >
                      {t.co.sym}
                    </text>
                    <text
                      x={t.x + LABEL_X}
                      y={t.y + CHG_Y}
                      fontSize={CHG_FONT}
                      fontWeight={600}
                      className="fill-foreground/90 font-mono tabular-nums"
                    >
                      {signed(t.co.chg, 1)}
                    </text>
                  </>
                )}
                {!big && t.w > LABEL_MIN_W && (
                  <text
                    x={t.x + t.w / HALF}
                    y={t.y + t.h / HALF + SMALL_BASELINE}
                    textAnchor="middle"
                    fontSize={SMALL_FONT}
                    fontWeight={600}
                    className="fill-foreground/70 font-mono"
                  >
                    {t.co.sym}
                  </text>
                )}
              </motion.g>
            );
          })}
        </svg>

        {hotTile && tip && (
          <div
            ref={tipRef}
            role="status"
            className="pointer-events-none absolute z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5"
            style={{ width: TIP_W, left: tip.left, top: tip.top }}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-label font-semibold text-foreground">{hotTile.co.sym}</span>
              <span
                className="font-mono text-label font-semibold tabular-nums"
                style={{ color: ink(hotTile.co.chg >= 0 ? UP : DOWN) }}
              >
                {signed(hotTile.co.chg, DP)}
              </span>
            </div>
            <div className="mt-0.5 text-micro text-muted-foreground">{hotTile.co.name}</div>
            <div className="mt-1 flex justify-between font-mono text-micro text-muted-foreground tabular-nums">
              <span>{formatPrice(hotTile.co.price)}</span>
              <span>{formatCap(hotTile.co.cap)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { MarketHeatmap };
