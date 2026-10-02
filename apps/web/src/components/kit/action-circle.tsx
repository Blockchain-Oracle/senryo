"use client";

// 21st: radiumcoders/grid-button (#13564, search "action buttons grid circle") — an icon disc over a short label with a
// press scale. Senryo: 56 px circles (D-196); a disabled circle keeps its place and names why in ≤ 4 words.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const DISC =
  "flex size-14 items-center justify-center rounded-full bg-raised-2 text-foreground transition-transform duration-(--motion-fast) ease-lacquer group-active:scale-97 group-hover:bg-row-pressed [&_svg]:size-5";

interface CircleProps {
  icon: ReactNode;
  label: string;
  /** A link target, or an action. */
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  /** Disabled with its reason (≤ 4 words), shown under the label. */
  locked?: string | undefined;
  external?: boolean;
}

export function ActionCircle({ icon, label, href, onClick, locked, external }: CircleProps) {
  const body = (
    <>
      <span aria-hidden className={cn(DISC, locked && "opacity-40")}>
        {icon}
      </span>
      <span className="text-meta text-text-2">{label}</span>
      {locked ? <span className="text-micro text-text-3">{locked}</span> : null}
    </>
  );
  const shell =
    "group flex w-18 flex-col items-center gap-1.5 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (locked)
    return (
      <span className={shell} aria-disabled title={locked}>
        {body}
      </span>
    );
  if (href && external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={shell}>
        {body}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={shell}>
      {body}
    </button>
  );
}

export function ActionCircles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-start justify-center gap-4", className)}>{children}</div>;
}
