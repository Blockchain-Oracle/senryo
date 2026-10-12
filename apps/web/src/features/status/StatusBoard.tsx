"use client";
/**
 * Status as a live evidence board (P6, D-324; the phone's Status — Owarine's pulse strip, Canton's status spec): one
 * verdict — Live, Delayed, Unavailable or Unverified — with a tally and when it was checked; a tile per component,
 * problems first, with its state, its numbers now, and a bar per hour (24 h) or day (90 d) whose height is the worst
 * state seen — grey where nothing was recorded, never a pass. Hover or focus a bar to read it. A tile's dot pulses only
 * when a new reading arrives. Everything is the api's own (`/v1/status` every 15 s, `/v1/status/history` every minute).
 */
import type { StatusHistory, StatusRange, StatusResponse } from "@senryo/api-client";
import {
  barLabel,
  barOf,
  boardOrder,
  COMPONENT_NAMES,
  type HealthState,
  metricLine,
  STATE_WORDS,
  uptimeText,
  verdict,
} from "@senryo/calls";
import { FEED_STATES } from "@senryo/config";
import { useStatus, useStatusHistory } from "@senryo/query";
import { motion } from "motion/react";
import { useState } from "react";
import { ErrorPanel, useRetry } from "@/components/ui/reading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "24h", label: "24 h" },
  { value: "90d", label: "90 d" },
] as const;
const PERCENT = 100;
const MS = 1000;
const SOURCE_NAMES: Readonly<Record<string, string>> = { pyth: "Pyth", redstone: "RedStone", basket: "Baskets" };
const TONE: Readonly<Record<HealthState | "none", string>> = {
  ok: "bg-up",
  degraded: "bg-warn",
  down: "bg-down",
  unknown: "bg-text-3",
  none: "bg-secondary",
};
const TEXT: Readonly<Record<HealthState, string>> = {
  ok: "text-foreground",
  degraded: "text-warn",
  down: "text-down",
  unknown: "text-text-3",
};

export function StatusBoard() {
  const [range, setRange] = useState<StatusRange>("24h");
  const status = useStatus();
  const history = useStatusHistory(range);
  const retry = useRetry(["status"]);
  if (status.status === "failed") return <ErrorPanel diagnosis={status.error} retry={retry} />;
  if (!("value" in status)) return <div aria-busy className="h-64 animate-pulse rounded-2xl bg-skeleton" />;
  const s = status.value;
  const h = "value" in history ? history.value : undefined;
  const v = verdict(s.components);
  const ago = Math.max(0, Math.round((Date.now() - Date.parse(s.at)) / MS));
  return (
    <div className="flex flex-col gap-6">
      <section aria-live="polite" className="flex flex-col gap-2">
        <span className={cn("font-display text-display-balance", TEXT[v.tone])}>{v.word}</span>
        <span className="text-body text-text-2">{v.line}</span>
        <div className="flex flex-wrap gap-2">
          {(["ok", "degraded", "down", "unknown"] as const).map((k) =>
            v.tally[k] > 0 ? (
              <span key={k} className="flex h-7 items-center gap-1.5 rounded-full bg-secondary px-3 text-meta">
                <span className={cn("size-2 rounded-full", TONE[k])} />
                {v.tally[k]} {STATE_WORDS[k].toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
        <span className="tnum text-meta text-text-3">Checked {ago} s ago · refreshes every 15 s</span>
      </section>
      <SegmentedControl
        options={RANGES}
        label="History range"
        value={range}
        onValueChange={(r) => setRange(r as StatusRange)}
        className="self-start"
      />
      <div className="grid gap-3 md:grid-cols-2">
        {boardOrder(s.components).map((c) => (
          <Tile key={c.id} c={c} at={s.at} history={h} s={s} />
        ))}
      </div>
    </div>
  );
}

function Tile({
  c,
  at,
  history,
  s,
}: {
  c: StatusResponse["components"][number];
  at: string;
  history: StatusHistory | undefined;
  s: StatusResponse;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const buckets = history?.components.find((x) => x.id === c.id)?.buckets ?? [];
  const uptime = uptimeText(buckets);
  const name = COMPONENT_NAMES[c.id];
  const problem = c.state === "down" || c.state === "degraded";
  return (
    <section
      aria-label={`${name.title}: ${STATE_WORDS[c.state]}`}
      className="flex flex-col gap-2 rounded-2xl bg-secondary p-4"
    >
      <div className="flex items-center gap-2">
        <motion.span
          key={at}
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          className={cn("size-2 rounded-full", TONE[c.state])}
        />
        <span className="flex-1 font-semibold text-row-title">{name.title}</span>
        <span className={cn("font-semibold text-row-title", TEXT[c.state])}>{STATE_WORDS[c.state]}</span>
      </div>
      <span className={cn("text-meta", problem ? "text-foreground" : "text-text-2")}>{metricLine(c) || name.what}</span>
      {history && buckets.length > 0 ? (
        <>
          <ol className="flex h-8 items-end gap-0.5" aria-label={`${name.title} history`}>
            {buckets.map((b, i) => {
              const bar = barOf(b);
              return (
                <li key={i} className="flex h-full flex-1">
                  <button
                    type="button"
                    aria-label={barLabel(history, i, b)}
                    onMouseEnter={() => setPicked(i)}
                    onMouseLeave={() => setPicked(null)}
                    onFocus={() => setPicked(i)}
                    onBlur={() => setPicked(null)}
                    className="flex h-full flex-1 items-end focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span
                      className={cn(
                        "w-full rounded-sm",
                        TONE[bar.tone],
                        picked !== null && picked !== i && "opacity-40",
                      )}
                      style={{ height: `${bar.height * PERCENT}%` }}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
          <span className="tnum text-micro text-text-3">
            {picked !== null
              ? barLabel(history, picked, buckets[picked] ?? null)
              : uptime
                ? `${uptime} working over the range`
                : "Not recorded yet"}
          </span>
        </>
      ) : null}
      {c.id === "prices"
        ? s.priceSources.map((p) => (
            <span key={p.source} className="text-micro text-text-3">
              {SOURCE_NAMES[p.source] ?? p.source} ·{" "}
              {FEED_STATES.flatMap((k) => (p.counts[k] ? [`${p.counts[k]} ${k}`] : [])).join(" · ") || "no markets"}
            </span>
          ))
        : null}
    </section>
  );
}
