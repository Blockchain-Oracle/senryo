import { IS_PREVIEW_DATA } from "@/lib/sample";
import { cn } from "@/lib/utils";

/** Visible on every screen fed by `src/lib/sample.ts`; removed screen by screen as S6–S8 wire real data. */
export function PreviewBadge({ className }: { className?: string }) {
  if (!IS_PREVIEW_DATA) return null;
  return (
    <span
      role="note"
      title="Sample values from src/lib/sample.ts — real data arrives in S6–S8"
      className={cn(
        "inline-flex items-center rounded-xs border border-gold/60 px-1.5 py-0.5 font-mono text-micro text-gold uppercase tracking-[0.14em]",
        className,
      )}
    >
      Preview data
    </span>
  );
}
