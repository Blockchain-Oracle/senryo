"use client";

/**
 * The desk's Reading states (the phone's `ReadingView`, plan §2.5): the loader only where nothing was ever known —
 * never an invented number; an error panel with Retry only when there is no cached value; a cached value that missed
 * its refreshes keeps showing under an "Updated 14:02 · refreshing" stamp. Fresh and stale share one tree, so a
 * child keeps its state across the change.
 */
import type { Diagnosis, Reading } from "@senryo/core";
import { type QueryKey, useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/ui/loading-state";
import { DIAGNOSIS_COPY, ERROR_COPY } from "@/lib/copy/diagnosis";
import { cn } from "@/lib/utils";

const CLOCK: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };

export interface RetryAction {
  run: () => void;
  busy: boolean;
}

/** Refetches everything under `queryKey`; `busy` is true while any of it is in flight (an honest Retrying… state). */
export function useRetry(queryKey: QueryKey): RetryAction {
  const client = useQueryClient();
  const busy = useIsFetching({ queryKey }) > 0;
  return { run: () => void client.invalidateQueries({ queryKey }), busy };
}

export function RetryButton({ retry, label, className }: { retry: RetryAction; label?: string; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={retry.run}
      disabled={retry.busy}
      aria-busy={retry.busy}
      aria-label={label}
      className={className}
    >
      <RotateCw className={cn(retry.busy && "animate-spin motion-reduce:animate-none")} aria-hidden />
      {retry.busy ? ERROR_COPY.retrying : ERROR_COPY.retry}
    </Button>
  );
}

/** The diagnosis in human words, a Retry where one can help, the technical line on request. */
export function ErrorPanel({
  diagnosis,
  retry,
  className,
}: {
  diagnosis: Diagnosis;
  retry?: RetryAction | undefined;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const copy = DIAGNOSIS_COPY[diagnosis.kind];
  return (
    <div
      role="alert"
      className={cn("grid justify-items-center gap-2 rounded-sm bg-destructive-surface p-4", className)}
    >
      <p className="font-semibold text-body">{copy.headline}</p>
      <p className="text-center text-caption text-muted-foreground">{copy.body}</p>
      {retry && diagnosis.kind !== "not-deployed" ? <RetryButton retry={retry} /> : null}
      {diagnosis.technical ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono text-micro text-muted-foreground hover:text-foreground"
        >
          {open ? "▾" : "▸"} {ERROR_COPY.technical}
        </button>
      ) : null}
      {open ? (
        <p className="select-text break-all font-mono text-micro text-muted-foreground">
          {diagnosis.kind} · {diagnosis.technical}
        </p>
      ) : null}
    </div>
  );
}

/** "Updated 14:02 · refreshing" in a polite live region. */
export function StaleStamp({ at, refreshing, failed }: { at: number; refreshing: boolean; failed: boolean }) {
  const tail = failed ? ERROR_COPY.staleFailed : refreshing ? "refreshing" : "stale";
  return (
    <p aria-live="polite" className={cn("font-mono text-micro", failed ? "text-warn" : "text-muted-foreground")}>
      Updated {new Date(at).toLocaleTimeString("en-GB", CLOCK)} · {tail}
    </p>
  );
}

export function ReadingView<T>({
  reading,
  loadingLabel = "Loading",
  skeleton,
  retry,
  className,
  children,
}: {
  reading: Reading<T>;
  loadingLabel?: string;
  /** Placeholder of what will arrive, under the loader, so the section keeps its size. */
  skeleton?: ReactNode;
  retry?: RetryAction | undefined;
  className?: string;
  children: (value: T) => ReactNode;
}) {
  switch (reading.status) {
    case "unknown":
      return (
        <div className={cn("grid gap-3", className)}>
          <LoadingState label={loadingLabel} />
          {skeleton}
        </div>
      );
    case "failed":
      return <ErrorPanel diagnosis={reading.error} retry={retry} className={className} />;
    case "stale":
    case "fresh":
      return (
        <>
          {reading.status === "stale" ? (
            <StaleStamp at={reading.at} refreshing={reading.refreshing} failed={reading.error !== undefined} />
          ) : null}
          {children(reading.value)}
        </>
      );
  }
}

/** The value of a Reading when one is known (fresh or stale), else undefined. */
export function known<T>(reading: Reading<T>): T | undefined {
  return reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
}
