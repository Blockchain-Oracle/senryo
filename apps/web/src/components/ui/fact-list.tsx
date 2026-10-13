"use client";
/**
 * The one fact list on the web (Q0, D-346; the phone's `FactList`): label on the left, value on the right in tabular
 * figures. Facts are typed — a money fact is masked with balances hidden by its type, not by each caller — and a list
 * at rest holds at most four (more is a disclosure's or a details view's job: pass `atRest={false}` there). In
 * development a fact drawn twice on one screen is reported (`fact-inspector`).
 */
import { useFactInspector } from "@/lib/dev/fact-inspector";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

export interface Fact {
  label: string;
  /** Formatted already; null reads "—". */
  value: string | null;
  money?: boolean;
}

export const MAX_FACTS_AT_REST = 4;

export function FactList({
  facts,
  atRest = true,
  className,
}: {
  facts: readonly Fact[];
  atRest?: boolean;
  className?: string;
}) {
  const hidden = usePrivacy();
  useFactInspector(facts, atRest ? MAX_FACTS_AT_REST : null);
  return (
    <dl className={cn("grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-body", className)}>
      {facts.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-text-3">{f.label}</dt>
          <dd className="tnum text-right font-semibold">
            {f.value === null ? "—" : f.money ? masked(f.value, hidden) : f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
