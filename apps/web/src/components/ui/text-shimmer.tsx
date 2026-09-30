"use client";

// 21st: ibelick/text-shimmer (#1641) — https://21st.dev/@ibelick/components/text-shimmer (D2 preview copy).
// Re-tokenized: base = --muted-foreground, sweep = --foreground (no hex), motion/react instead of framer-motion,
// linear sweep kept (a shimmer is the one place a constant velocity reads right). Static under reduced motion.
import { type MotionStyle, motion, useReducedMotion } from "motion/react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION_S = 2;
const DEFAULT_SPREAD = 2;

interface TextShimmerProps {
  children: string;
  as?: "p" | "span" | "div";
  className?: string;
  duration?: number;
  /** Highlight width per character (in the unit of the font size). */
  spread?: number;
}

export function TextShimmer({
  children,
  as = "span",
  className,
  duration = DEFAULT_DURATION_S,
  spread = DEFAULT_SPREAD,
}: TextShimmerProps) {
  const reduced = useReducedMotion() === true;
  if (reduced) {
    const Static = as as ElementType;
    return <Static className={cn("text-muted-foreground", className)}>{children}</Static>;
  }
  const Moving = motion[as];
  const style = {
    "--spread": `${children.length * spread}px`,
    backgroundImage:
      "linear-gradient(90deg, transparent calc(50% - var(--spread)), var(--foreground), transparent calc(50% + var(--spread))), linear-gradient(var(--muted-foreground), var(--muted-foreground))",
  } as MotionStyle;
  return (
    <Moving
      className={cn(
        "relative inline-block bg-size-[250%_100%,auto] bg-clip-text text-transparent [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{ repeat: Number.POSITIVE_INFINITY, duration, ease: "linear" }}
      style={style}
    >
      {children}
    </Moving>
  );
}
