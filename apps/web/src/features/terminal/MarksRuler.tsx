"use client";
/**
 * A ruler of marks (Q1, Codex direction 16 §1–2; the phone's `MarksSlider`): the installed Marks Slider stepping
 * through a short list — leverage multiples, a ride's trail distances, a call's bid cents — with each mark's label
 * under its stop, the chosen one in ink, a tick on each change.
 */
import { MarksSlider } from "@/components/ui/marks-slider";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const PERCENT = 100;

export function MarksRuler({
  marks,
  value,
  onChange,
  format,
  label,
}: {
  marks: readonly number[];
  value: number;
  onChange: (next: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  const index = Math.max(0, marks.indexOf(value));
  const last = Math.max(1, marks.length - 1);
  return (
    <div className="flex flex-col gap-1">
      <MarksSlider
        value={index}
        min={0}
        max={last}
        step={1}
        stops={marks.map((_, i) => i / last)}
        label={label}
        valueText={format(value)}
        onValueChange={(i) => {
          const next = marks[i];
          if (next === undefined || next === value) return;
          fire("tick", { cue: "tap" });
          onChange(next);
        }}
      />
      <div aria-hidden className="relative h-4">
        {marks.map((m, i) => (
          <span
            key={m}
            className={cn("-translate-x-1/2 tnum absolute text-meta", i === index ? "text-foreground" : "text-text-3")}
            style={{ left: `${(i / last) * PERCENT}%` }}
          >
            {format(m)}
          </span>
        ))}
      </div>
    </div>
  );
}
