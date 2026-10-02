"use client";

/**
 * The one outcome surface (Part A rule 8; flow book rule 5), the phone's `TradeTrace` on the web: one status glyph, one
 * headline, the caller's key facts, the next action; the stages and hash fold under Details. Truth rules: success is
 * finalized only; a signed send the live watch lost is "Not confirmed yet" — never "failed" — and offers no new
 * action until the journal settles it; a failure never resends, it hands back to review; partial completion stays
 * visible.
 */
import { explorerTxUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import type { OperationRecord, TraceEvent, TraceOutcome, TraceStage } from "@senryo/query";
import { ChevronDown, CircleCheck, History, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { SPRING_PRESS } from "@/lib/constants/motion";
import { cn } from "@/lib/utils";
import { failureWords, ORDER_WORDS, type TraceWords } from "./trace-words";

const STEPS: ReadonlyArray<{ label: string; stage: TraceStage }> = [
  { label: "Checking", stage: "checking" },
  { label: "Signed", stage: "signed" },
  { label: "Proposed", stage: "proposed" },
  { label: "Voted", stage: "voted" },
  { label: "Finalized", stage: "finalized" },
];
const MS_PER_SECOND = 1000;
const TENTHS = 10;
const seconds = (ms: number) => `${Math.round(ms / (MS_PER_SECOND / TENTHS)) / TENTHS}s`;

type Phase = "running" | "success" | "failed" | "unknown";

export function OperationStatus({
  events,
  record,
  running,
  outcome,
  words = ORDER_WORDS,
  facts,
  details: extra,
  next,
  onDone,
  onLeave,
}: {
  events: readonly TraceEvent[];
  record?: OperationRecord | undefined;
  running: boolean;
  /** The settled outcome (`useSettledOutcome`): `unknown` until the journal has the signed tx's result. */
  outcome: TraceOutcome | undefined;
  words?: TraceWords;
  facts?: ReactNode;
  details?: ReactNode;
  next?: ReactNode;
  onDone: () => void;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const partial =
    record?.steps.some((s) => s.outcome === "completed") &&
    (record.steps.some((s) => s.outcome !== "completed") || record.steps.length < record.plannedActions.length);
  const start = events[0]?.at ?? Date.now();
  const unknown = outcome === "unknown";
  const failed = unknown
    ? undefined
    : events.find((e) => e.stage === "failed" || e.stage === "reverted" || e.stage === "abandoned");
  const recovered = events.at(-1)?.stage === "failed" && outcome !== undefined && outcome !== "not-sent" && !unknown;
  const landed = recovered && outcome === "finalized";
  const hash = events.find((e) => e.hash)?.hash;
  const settled = events.some((e) => e.stage === "finalized");
  const phase: Phase = unknown ? "unknown" : settled || landed ? "success" : failed ? "failed" : "running";

  const headline =
    phase === "success"
      ? (words.success ?? "Done")
      : phase === "unknown"
        ? "Not confirmed yet"
        : phase === "failed"
          ? partial
            ? "Partly done"
            : "Didn’t go through"
          : (words.pending ?? "Processing");
  const reason =
    phase === "unknown"
      ? `Signed — checking the chain. Don’t ${words.again}.`
      : recovered
        ? outcome === "finalized"
          ? words.landed
          : outcome === "reverted"
            ? words.reverted
            : "It wasn’t included. Review it again."
        : phase === "failed" && failed
          ? failed.stage === "reverted"
            ? partial
              ? "This step reverted. Earlier steps remain."
              : words.reverted
            : failed.stage === "abandoned"
              ? "It wasn’t included. Review it again."
              : partial
                ? "This step didn’t finish. Earlier steps remain."
                : failureWords(failed.error, words.thing)
          : phase === "running"
            ? words.leave
            : undefined;
  const tone =
    phase === "success" ? "text-up" : phase === "failed" ? "text-down" : phase === "unknown" ? "text-warn" : "";

  return (
    <div className="flex flex-col gap-4 py-6">
      <div aria-hidden className={cn("grid h-20 place-items-center", tone)}>
        {phase === "running" ? (
          <Loader2 className="size-12 animate-spin text-text-2" />
        ) : (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING_PRESS}
          >
            {phase === "success" ? (
              <CircleCheck className="size-16" />
            ) : phase === "failed" ? (
              <X className="size-16" strokeWidth={2.5} />
            ) : (
              <History className="size-16" />
            )}
          </motion.span>
        )}
      </div>
      <div className="grid gap-1 text-center" aria-live="polite">
        <h2 className="text-sheet-title">{headline}</h2>
        {reason ? <p className={cn("text-meta", phase === "running" ? "text-text-2" : tone)}>{reason}</p> : null}
      </div>
      {facts ? <div className="grid gap-0.5">{facts}</div> : null}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-1 text-meta text-text-2 hover:text-foreground"
      >
        Details <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="grid gap-2">
          {extra}
          <ol className="grid gap-1">
            {STEPS.map((s) => {
              const at = events.find((e) => e.stage === s.stage)?.at;
              return (
                <li key={s.stage} className="flex justify-between text-meta">
                  <span className={at === undefined ? "text-text-3" : "text-foreground"}>{s.label}</span>
                  <span className="text-text-3 tnum">{at === undefined ? "—" : seconds(at - start)}</span>
                </li>
              );
            })}
          </ol>
          {hash ? (
            <a
              href={explorerTxUrl(ACTIVE_NETWORK.chainId, hash)}
              target="_blank"
              rel="noreferrer"
              className="text-meta text-link hover:underline"
            >
              Transaction {shortAddress(hash)}
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-2">
        {phase === "success" ? next : null}
        {phase === "unknown" || (phase === "running" && running) ? (
          <Button variant={phase === "unknown" ? "outline" : "ghost"} size="xl" onClick={onLeave}>
            Leave this page
          </Button>
        ) : phase === "running" ? null : (
          <Button variant={phase === "success" ? "default" : "outline"} size="xl" onClick={onDone}>
            {phase === "success" || outcome === "finalized" ? words.done : words.back}
          </Button>
        )}
      </div>
    </div>
  );
}
