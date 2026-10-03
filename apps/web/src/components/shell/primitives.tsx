import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A group's label in a settings list: one quiet line above its rows. */
export function SectionLabel({
  children,
  className,
  right,
}: {
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <div className={cn("flex items-baseline justify-between pt-6 pb-2", className)}>
      <h2 className="text-meta text-text-2">{children}</h2>
      {right}
    </div>
  );
}

/** Tabular mono number. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono tnum", className)}>{children}</span>;
}

/** A raised group of rows (settings sections): no hairline box, the surface carries it. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-md bg-raised-2", className)}>{children}</div>;
}

/** ▲/▼ + sign with every colour (accessibility rule, plan §2.5). */
export function Direction({ up, children, className }: { up: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono tnum", up ? "text-up" : "text-down", className)}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {children}
    </span>
  );
}
