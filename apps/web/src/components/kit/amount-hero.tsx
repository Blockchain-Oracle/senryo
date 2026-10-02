import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one hero number per screen (Part A rule 1): Inter Display, the decimals in text-3, `≈` + ⓘ when partial. `text` is
 * already formatted ("P$1,204.50"); the split happens at the last decimal point.
 */
export function AmountHero({
  text,
  partial,
  partialLabel = "Some values are missing",
  className,
  tone,
}: {
  text: string;
  partial?: boolean;
  partialLabel?: string;
  className?: string;
  tone?: "up" | "down" | undefined;
}) {
  const dot = text.lastIndexOf(".");
  const whole = dot >= 0 ? text.slice(0, dot) : text;
  const decimals = dot >= 0 ? text.slice(dot) : "";
  return (
    <p
      className={cn(
        "flex items-center gap-2 font-display text-display-balance tnum",
        tone === "up" && "text-up",
        tone === "down" && "text-down",
        className,
      )}
    >
      <span>
        {partial ? <span className="text-text-3">≈ </span> : null}
        {whole}
        <span className={tone ? "opacity-60" : "text-text-3"}>{decimals}</span>
      </span>
      {partial ? (
        <span title={partialLabel} className="text-text-3">
          <Info className="size-4" aria-label={partialLabel} />
        </span>
      ) : null}
    </p>
  );
}
