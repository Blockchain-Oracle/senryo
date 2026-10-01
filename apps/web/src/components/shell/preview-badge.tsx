import { cn } from "@/lib/utils";

/**
 * Marks a section still fed by `src/lib/sample.ts` (S11b removes it section by section as each is connected). `missing`
 * says, visibly, what the section is waiting for — the badge never stands alone.
 */
export function PreviewBadge({
  missing,
  tag = "Preview data",
  className,
}: {
  missing: string;
  /** The chip's word: "Preview data" for sample values, or what isn't connected ("Not sent"). */
  tag?: string;
  className?: string;
}) {
  return (
    <p role="note" className={cn("flex items-start gap-2 text-caption text-muted-foreground", className)}>
      <span className="inline-flex shrink-0 items-center rounded-xs border border-gold/60 px-1.5 py-0.5 font-mono text-gold text-micro uppercase tracking-[0.14em]">
        {tag}
      </span>
      <span className="pt-px">{missing}</span>
    </p>
  );
}
