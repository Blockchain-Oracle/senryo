"use client";
/**
 * Action circles (D-196, D-352; the phone's `ActionCircle`; 21st.dev radiumcoders/grid-button #13564): a 56 px disc
 * with a 24 px icon over a 12/16 label, spread evenly in a row. One may be the row's main action on the brand colour
 * (Replay on a receipt); a disc can carry a brand's own mark (X on Post); a busy disc spins; an unavailable one keeps
 * its place, dimmed, with its reason (≤ 4 words) under the label.
 */
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ActionCircle({
  icon,
  label,
  accessibleName,
  onClick,
  primary = false,
  busy = false,
  reason,
}: {
  icon: ReactNode;
  label: string;
  /** When the label alone isn't the whole name ("Post on X"). */
  accessibleName?: string;
  onClick: () => void;
  primary?: boolean;
  busy?: boolean;
  /** Why it can't be used here; an empty string dims it without words. */
  reason?: string;
}) {
  const disabled = reason !== undefined || busy;
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-[5.5rem] flex-1 flex-col items-center gap-2",
        reason !== undefined && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={busy}
        aria-label={reason ? `${accessibleName ?? label}, ${reason}` : (accessibleName ?? label)}
        className={cn(
          "flex size-14 items-center justify-center rounded-full transition-[transform,background-color] duration-(--motion-fast) ease-desk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none [&_svg]:size-6",
          primary
            ? "bg-accent text-accent-foreground hover:bg-accent/90"
            : "bg-secondary text-foreground hover:bg-secondary/80",
        )}
      >
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : icon}
      </button>
      <span className="text-center text-label text-foreground">{label}</span>
      {reason ? <span className="text-center text-meta text-text-3">{reason}</span> : null}
    </div>
  );
}

/** A row of circles spread evenly (Replay · Post · Share · Save). */
export function ActionCircles({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-start justify-evenly gap-2">{children}</div>;
}
