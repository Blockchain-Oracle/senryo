"use client";

// 21st: 8starlabs/partition-bar (#26545) — https://21st.dev/@8starlabs/components/partition-bar
// Re-tokenized for D2 Desk: square segments by default (`shape="pill"` restores the source look), mono labels,
// value in --muted-foreground (was slate-500), extra `gold` / `muted` variants for the FREE·SPEND / LOCKED buckets.

import { cva, type VariantProps } from "class-variance-authority";
import {
  Children,
  createContext,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { cn } from "@/lib/utils";

const partitionBarVariants = cva("flex flex-row", {
  variants: { size: { sm: "text-micro", md: "text-label", lg: "text-caption" } },
  defaultVariants: { size: "md" },
});

type Size = VariantProps<typeof partitionBarVariants>["size"];
type Shape = "square" | "pill";

type Ctx = { total: number; size: Size; shape: Shape };
const PartitionBarCtxt = createContext<Ctx | null>(null);

function usePartitionBarContext(): Ctx {
  const context = useContext(PartitionBarCtxt);
  if (!context) throw new Error("PartitionBarSegment must be used within a PartitionBar");
  return context;
}

const GAP_UNIT_REM = 0.25;
const PERCENT = 100;

export interface PartitionBarProps extends HTMLAttributes<HTMLUListElement>, VariantProps<typeof partitionBarVariants> {
  children?: ReactElement<PartitionBarSegmentProps> | ReactElement<PartitionBarSegmentProps>[];
  /** gap between segments in Tailwind spacing units (1 = 0.25rem) */
  gap?: number;
  shape?: Shape;
}

export default function PartitionBar({
  children,
  className,
  gap = 1,
  size,
  shape = "square",
  ...props
}: PartitionBarProps) {
  const total = Children.toArray(children).reduce<number>(
    (sum, child) => (isValidElement<PartitionBarSegmentProps>(child) ? sum + (child.props.num ?? 0) : sum),
    0,
  );
  return (
    <PartitionBarCtxt.Provider value={{ total, size, shape }}>
      <ul
        className={cn("w-full", partitionBarVariants({ size }), className)}
        style={{ gap: `${gap * GAP_UNIT_REM}rem` }}
        {...props}
      >
        {children}
      </ul>
    </PartitionBarCtxt.Provider>
  );
}

const lineVariants = cva("", {
  variants: {
    variant: {
      default: "bg-primary",
      secondary: "bg-primary/60",
      gold: "bg-gold",
      destructive: "bg-destructive",
      outline: "border border-input bg-background",
      muted: "bg-muted-foreground/40",
    },
  },
  defaultVariants: { variant: "default" },
});

const titleVariants = cva("", {
  variants: {
    variant: {
      default: "text-primary",
      secondary: "text-primary/60",
      gold: "text-gold",
      destructive: "text-destructive",
      outline: "text-foreground",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface PartitionBarSegmentProps extends HTMLAttributes<HTMLLIElement>, VariantProps<typeof lineVariants> {
  children?: ReactNode;
  num?: number;
  alignment?: "left" | "center" | "right";
}

export function PartitionBarSegment({
  children,
  num = 0,
  variant = "default",
  alignment = "center",
  className,
  ...props
}: PartitionBarSegmentProps) {
  const { total, size, shape } = usePartitionBarContext();
  const widthPercent = total > 0 ? (num / total) * PERCENT : 0;
  return (
    <li
      className="flex min-w-0 flex-col"
      style={{ flexBasis: `${widthPercent}%`, flexGrow: 0, flexShrink: 0 }}
      {...props}
    >
      <div
        className={cn(
          lineVariants({ variant }),
          "w-full shrink-0",
          shape === "pill" ? "rounded-full" : "rounded-none",
          size === "sm" ? "h-2" : size === "lg" ? "h-4" : "h-3",
          className,
        )}
      />
      <div
        className={cn(
          titleVariants({ variant }),
          "flex w-full flex-col whitespace-normal font-mono",
          size === "sm" ? "mt-2" : size === "lg" ? "mt-4" : "mt-3",
          alignment === "left" && "items-start",
          alignment === "center" && "items-center",
          alignment === "right" && "items-end",
        )}
      >
        {children}
      </div>
    </li>
  );
}

export function PartitionBarSegmentTitle({ children, className }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-fit font-semibold uppercase tracking-label", className)}>{children}</div>;
}

export function PartitionBarSegmentValue({ children, className }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-fit text-muted-foreground tabular-nums", className)}>{children}</div>;
}

export { PartitionBar };
