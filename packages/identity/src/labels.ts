/**
 * Accessible names for a mark in each state. The artwork is announced as the entity's name; every non-art state says
 * plainly that no logo is shown, so a fallback can never pass for the real mark (study 08 §Acceptance).
 */
import type { MarkPlan } from "./registry.ts";

export type MarkStatus = "ready" | "loading" | "failed";

export function markLabel(plan: MarkPlan | undefined, status: MarkStatus, text: string, badge?: MarkPlan): string {
  const base = (() => {
    if (status === "loading") return `${text}, loading logo`;
    if (status === "failed") return `${text}, logo unavailable`;
    if (!plan || plan.kind === "unidentified") return `${text}, unidentified`;
    if (plan.kind === "gap") return `${plan.entity.name}, no logo on file`;
    return `${plan.entity.name}${plan.entity.practice ? " (practice)" : ""}`;
  })();
  if (!badge || badge.kind === "unidentified") return base;
  return `${base}, ${badge.entity.name} ${badge.entity.role}`;
}
