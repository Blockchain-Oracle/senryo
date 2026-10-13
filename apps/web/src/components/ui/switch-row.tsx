"use client";
/**
 * A row that is one switch (the phone's `Switch` in a list row): its name, an optional detail, and the track on the
 * right — the whole row toggles. Settings (sound, hide balances, theme) and the ride's Leverage (D-344) use it.
 */
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function SwitchRow({
  label,
  detail,
  on,
  onChange,
}: {
  label: string;
  detail?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        onChange(!on);
        fire("tick", { cue: "toggle" });
      }}
      className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row">{label}</span>
        {detail ? <span className="text-meta text-text-3">{detail}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-(--motion-base)",
          on ? "bg-primary" : "bg-row-pressed",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full transition-transform duration-(--motion-base) ease-lacquer",
            // On: the primary's own ink (white on black in light, black on white in dark), as the phone's switch.
            on ? "translate-x-5.5 bg-primary-foreground" : "translate-x-0.5 bg-white",
          )}
        />
      </span>
    </button>
  );
}
