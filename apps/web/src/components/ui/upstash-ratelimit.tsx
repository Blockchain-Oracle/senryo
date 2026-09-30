"use client";

// 21st: elements-/upstash-ratelimit (#29280) — https://21st.dev/@elements-/components/upstash-ratelimit
// D2 "SPEND LIMIT · 24H" meter (Free-to-spend). Re-tokenized: --up > 50 %, --gold > 20 %, --down below, --destructive on
// failure; mono caps title; exposed as role="meter". The reset countdown starts after mount (static export safe).
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MS_PER_S = 1000;
const S_PER_MIN = 60;
const MIN_PER_H = 60;
const PERCENT = 100;
const HEALTHY_PCT = 50;
const LOW_PCT = 20;
const TICK_MS = 1000;

interface UpstashRatelimitProps {
  limit: number;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
  success?: boolean;
  showResetTimer?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
  okLabel?: string;
  failLabel?: string;
  format?: (n: number) => string;
  resetLabel?: string;
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const seconds = Math.floor(ms / MS_PER_S);
  const minutes = Math.floor(seconds / S_PER_MIN);
  const hours = Math.floor(minutes / MIN_PER_H);
  if (hours > 0) return `${hours}h ${minutes % MIN_PER_H}m`;
  if (minutes > 0) return `${minutes}m ${seconds % S_PER_MIN}s`;
  return `${seconds}s`;
}

const SIZE_CLASSES = {
  sm: { container: "p-3 gap-2", icon: "size-4", text: "text-caption", bar: "h-1.5" },
  md: { container: "p-4 gap-3", icon: "size-5", text: "text-body", bar: "h-2" },
  lg: { container: "p-5 gap-4", icon: "size-6", text: "text-title", bar: "h-2.5" },
} as const;

function tone(success: boolean, pct: number): { text: string; bar: string } {
  if (!success) return { text: "text-destructive", bar: "bg-destructive" };
  if (pct > HEALTHY_PCT) return { text: "text-up", bar: "bg-up" };
  if (pct > LOW_PCT) return { text: "text-gold", bar: "bg-gold" };
  return { text: "text-down", bar: "bg-down" };
}

export function UpstashRatelimit({
  limit,
  remaining,
  reset,
  success = true,
  showResetTimer = true,
  size = "md",
  className,
  title = "Rate limit",
  okLabel = "Available",
  failLabel = "Limit reached",
  format = (n: number) => String(n),
  resetLabel = "Resets in",
}: UpstashRatelimitProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const percentage = limit > 0 ? (remaining / limit) * PERCENT : 0;
  const sizes = SIZE_CLASSES[size];
  const colors = tone(success, percentage);

  useEffect(() => {
    if (!showResetTimer) return;
    const update = () => setTimeRemaining(Math.max(0, reset - Date.now()));
    update();
    const interval = setInterval(update, TICK_MS);
    return () => clearInterval(interval);
  }, [reset, showResetTimer]);

  return (
    <div
      data-slot="upstash-ratelimit"
      className={cn("flex flex-col rounded-lg border border-border bg-card font-mono", sizes.container, className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldIcon className={cn(sizes.icon, colors.text)} />
          <span className={cn("font-medium uppercase", sizes.text)}>{title}</span>
        </div>
        <div className={cn("tnum", sizes.text, colors.text)}>
          {format(remaining)} / {format(limit)}
        </div>
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: a native meter element cannot be token-styled consistently across engines */}
      <div
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={remaining}
        aria-valuetext={`${format(remaining)} of ${format(limit)} left`}
        className={cn("w-full overflow-hidden rounded-full bg-muted", sizes.bar)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-(--motion-slow) ease-desk", colors.bar)}
          style={{ width: `${Math.min(PERCENT, Math.max(percentage, 0))}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-muted-foreground", sizes.text)}>{success ? okLabel : failLabel}</span>
        {showResetTimer && timeRemaining !== null && timeRemaining > 0 && (
          <span className={cn("text-muted-foreground tnum", sizes.text)}>
            {resetLabel} {formatTimeRemaining(timeRemaining)}
          </span>
        )}
      </div>
    </div>
  );
}

export default UpstashRatelimit;
