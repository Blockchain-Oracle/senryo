"use client";
/**
 * One line that opens (UGLYCASH's "Fee: $0.95 ⌄", Codex direction 16; the phone's `DisclosureRow`): a title and its
 * value at rest, the detail or the control only when opened. How a settings sheet keeps one thing per line.
 */
import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function DisclosureRow({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          fire("tick", { cue: "tap" });
          setOpen((o) => !o);
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex-1 font-medium text-row">{title}</span>
        <span className="tnum font-semibold text-row">{value}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-text-3 transition-transform duration-(--motion-base)", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-2 px-1 pb-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
