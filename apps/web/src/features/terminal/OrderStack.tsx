"use client";
/**
 * Tradash's floating order stack (Codex direction 11 §2, R5.4) on the chart's left edge: four rows of glyph and value
 * — for a call Stake · Pays · Fees · Exit, for a ride Margin · Leverage · Fees · Trail — under the instrument's name.
 * It peeks in from the edge, drags up and down within the chart, and one tap opens the order's settings.
 */
import { BadgePercent, Coins, Crosshair, Gauge, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType, ReactNode, RefObject } from "react";
import { LiveText } from "@/components/kit/live-text";
import { EASE_OUT } from "@/lib/constants/motion";
import { tapFeedback } from "@/lib/feedback";
import type { LiveValue } from "@/lib/terminal/live-value";
import "./order-stack.css";

const PEEK = { x: -12, delayS: 0.35, durationS: 0.4 };

export interface StackRow {
  icon: "coins" | "gauge" | "fees" | "exit" | "trail";
  label: string;
  value: string | LiveValue<string>;
}

const ICONS: Readonly<Record<StackRow["icon"], ComponentType<{ className?: string; "aria-hidden"?: boolean }>>> = {
  coins: Coins,
  gauge: Gauge,
  fees: BadgePercent,
  exit: Crosshair,
  trail: TrendingDown,
};

function Value({ value }: { value: StackRow["value"] }): ReactNode {
  return typeof value === "string" ? value : <LiveText value={value} />;
}

export function OrderStack({
  heading,
  rows,
  bounds,
  onOpen,
}: {
  heading: string;
  rows: readonly StackRow[];
  /** The chart it floats on: the drag stays inside it. */
  bounds: RefObject<HTMLElement | null>;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      className="order-stack"
      aria-label={`${heading} settings: ${rows.map((r) => r.label).join(", ")}`}
      drag={reduce ? false : "y"}
      dragConstraints={bounds}
      dragElastic={0.08}
      dragMomentum={false}
      initial={reduce ? false : { x: PEEK.x, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: PEEK.delayS, duration: PEEK.durationS, ease: EASE_OUT }}
      onTap={() => {
        tapFeedback();
        onOpen();
      }}
    >
      <span className="order-stack-heading">{heading}</span>
      {rows.map((r) => {
        const Icon = ICONS[r.icon];
        return (
          <span key={r.label} className="order-stack-row" title={r.label}>
            <Icon aria-hidden className="order-stack-glyph" />
            <span className="order-stack-value tnum">
              <Value value={r.value} />
            </span>
          </span>
        );
      })}
    </motion.button>
  );
}
