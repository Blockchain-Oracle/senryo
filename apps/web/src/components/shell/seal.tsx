import { cn } from "@/lib/utils";

/** Inline 千 seal for the top bar (the full SVG mark lives in brand/ and public/brand/). */
export function SealMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-xs bg-gold font-bold text-caption text-background leading-none",
        className,
      )}
    >
      千
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SealMark />
      <span className="font-bold font-mono text-num-sm tracking-tight">SENRYO</span>
    </span>
  );
}
