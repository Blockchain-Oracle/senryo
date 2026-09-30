"use client";

import { MOTION } from "@senryo/tokens";
// 21st: lavikatiyar/alert-toast (#8863) — https://21st.dev/@lavikatiyar/components/alert-toast
// D2 risk events: error = --down (stale feed, blocked risk), warning = --warn (margin health), info = muted
// (card decline), success = --up. Tokens only; square-ish corners, hairline border, no shadow; tween, no spring.
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, X, XOctagon } from "lucide-react";
import { type HTMLMotionProps, motion } from "motion/react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const TWEEN = { duration: 0.16, ease: MOTION.easing };

const alertToastVariants = cva("relative flex w-full items-start gap-4 overflow-hidden rounded-lg p-4", {
  variants: {
    variant: { success: "", warning: "", info: "", error: "" },
    styleVariant: { default: "border bg-background text-foreground", filled: "text-background" },
  },
  compoundVariants: [
    { variant: "success", styleVariant: "default", className: "border-up/70" },
    { variant: "warning", styleVariant: "default", className: "border-warn/70" },
    { variant: "info", styleVariant: "default", className: "border-muted-foreground/50" },
    { variant: "error", styleVariant: "default", className: "border-down/80 text-down" },
    { variant: "success", styleVariant: "filled", className: "bg-up" },
    { variant: "warning", styleVariant: "filled", className: "bg-warn" },
    { variant: "info", styleVariant: "filled", className: "bg-muted-foreground" },
    { variant: "error", styleVariant: "filled", className: "bg-down" },
  ],
  defaultVariants: { variant: "info", styleVariant: "default" },
});

type AlertVariant = "success" | "warning" | "info" | "error";
type AlertStyle = "default" | "filled";

const ICONS = { success: CheckCircle2, warning: AlertTriangle, info: Info, error: XOctagon } as const;

const ICON_COLOR: Record<AlertStyle, Record<AlertVariant, string>> = {
  default: { success: "text-up", warning: "text-warn", info: "text-muted-foreground", error: "text-down" },
  filled: { success: "", warning: "", info: "", error: "" },
};

/** Screen-reader prefix so colour is never the only signal. */
const SR_LABEL: Record<AlertVariant, string> = { success: "Done", warning: "Warning", info: "Notice", error: "Error" };

export interface AlertToastProps
  extends Omit<HTMLMotionProps<"div">, "title" | "children">,
    VariantProps<typeof alertToastVariants> {
  title: string;
  description: string;
  /** Omit to render without a dismiss button (persistent risk banner). */
  onClose?: () => void;
}

const AlertToast = forwardRef<HTMLDivElement, AlertToastProps>(
  ({ className, variant, styleVariant, title, description, onClose, ...props }, ref) => {
    const v: AlertVariant = variant ?? "info";
    const s: AlertStyle = styleVariant ?? "default";
    const Icon = ICONS[v];

    return (
      <motion.div
        ref={ref}
        role={v === "error" || v === "warning" ? "alert" : "status"}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={TWEEN}
        className={cn(alertToastVariants({ variant: v, styleVariant: s }), className)}
        {...props}
      >
        <Icon className={cn("size-6 shrink-0", ICON_COLOR[s][v])} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-body">
            <span className="sr-only">{SR_LABEL[v]}: </span>
            {title}
          </p>
          <p className="text-body opacity-90">{description}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Dismiss: ${title}`}
            className={cn(
              "shrink-0 rounded-full p-1 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              s === "default" ? "text-foreground/70 hover:bg-muted" : "hover:bg-background/20",
            )}
          >
            <X className="size-5" />
          </button>
        )}
      </motion.div>
    );
  },
);
AlertToast.displayName = "AlertToast";

export { AlertToast, alertToastVariants };
