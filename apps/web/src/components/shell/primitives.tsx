import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** D2 section label: mono, uppercase, widely tracked, muted. */
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
    <div className={cn("flex items-baseline justify-between px-4 pt-6 pb-2", className)}>
      <h2 className="font-mono text-label text-muted-foreground uppercase tracking-[0.2em]">{children}</h2>
      {right}
    </div>
  );
}

/** Tabular mono number. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono tnum", className)}>{children}</span>;
}

/** Hairline-bordered panel used for registers and tables. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border border-border", className)}>{children}</div>;
}

/** ▲/▼ + sign with every colour (accessibility rule, plan §2.5). */
export function Direction({ up, children, className }: { up: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono tnum", up ? "text-up" : "text-down", className)}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {children}
    </span>
  );
}
