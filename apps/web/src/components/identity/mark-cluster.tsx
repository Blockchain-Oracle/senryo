"use client";

import { EntityMark } from "@/components/identity/entity-mark";
import { cn } from "@/lib/utils";

/** A few real marks overlapping (the phone's MarkCluster): what a way in or out moves through, largest first. */
export function MarkCluster({ ids, size, className }: { ids: readonly string[]; size: number; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {ids.map((id, i) => (
        <span
          key={id}
          className={cn("rounded-full ring-2 ring-background", i > 0 && "-ml-2")}
          style={{ zIndex: ids.length - i }}
        >
          <EntityMark id={id} size={size} decorative />
        </span>
      ))}
    </span>
  );
}
