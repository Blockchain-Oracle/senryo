"use client";
/**
 * A call's steps, oldest first (21st.dev cubby-ui/timeline #28295, ported as plain markup — the original's Base UI
 * render helpers aren't in this app): a disc per step joined by a rule, the step's words, its time, and the
 * transaction one click away. Done steps carry a check, a refusal a cross, the step still running a hollow disc, so
 * state never rests on colour alone.
 */
import type { Step } from "@senryo/calls";
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { Check, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CallTimeline({ steps, chainId }: { steps: readonly Step[]; chainId: ChainId }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const body = (
          <>
            <span className="relative flex w-6 shrink-0 justify-center">
              <span
                className={cn(
                  "z-[1] mt-0.5 grid size-6 place-items-center rounded-full border-2",
                  s.state === "running"
                    ? "border-text-3 bg-transparent"
                    : s.state === "failed"
                      ? "border-down bg-secondary"
                      : "border-foreground bg-secondary",
                )}
              >
                {s.state === "done" ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
                {s.state === "failed" ? <X aria-hidden className="size-3 text-down" strokeWidth={3} /> : null}
              </span>
              {last ? null : <span aria-hidden className="absolute top-7 bottom-0 w-0.5 bg-border" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col pb-5">
              <span
                className={cn(
                  "font-semibold text-row",
                  s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : "text-foreground",
                )}
              >
                {s.title}
              </span>
              <span className="flex items-center gap-1 text-meta text-text-3">
                {s.when}
                {s.txHash ? (
                  <>
                    {" · View transaction"}
                    <ExternalLink aria-hidden className="size-3" />
                  </>
                ) : null}
              </span>
            </span>
          </>
        );
        return (
          <li key={s.key}>
            {s.txHash ? (
              <a
                href={explorerTxUrl(chainId, s.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-md hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {body}
              </a>
            ) : (
              <div className="flex gap-3">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
