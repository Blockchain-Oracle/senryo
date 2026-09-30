"use client";

// 21st: remcostoeten/interactive-empty-state (#22302) — https://21st.dev/@remcostoeten/components/interactive-empty-state
// D2: the component's own light/dark/neutral `theme` prop is gone — every colour is a token, so next-themes drives it.
// `error` uses the --down tint (outage states). Tweens only (no springs): "nothing bounces".
import { domAnimation, type HTMLMotionProps, LazyMotion, m } from "motion/react";
import { forwardRef, memo, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

const ICON_VARIANTS = {
  left: {
    initial: { scale: 0.8, opacity: 0, x: 0, y: 0, rotate: 0 },
    animate: { scale: 1, opacity: 1, x: 0, y: 0, rotate: -6, transition: { duration: 0.2, delay: 0.05 } },
    hover: { x: -22, y: -5, rotate: -15, scale: 1.1, transition: { duration: 0.16 } },
  },
  center: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { duration: 0.2, delay: 0.1 } },
    hover: { y: -10, scale: 1.15, transition: { duration: 0.16 } },
  },
  right: {
    initial: { scale: 0.8, opacity: 0, x: 0, y: 0, rotate: 0 },
    animate: { scale: 1, opacity: 1, x: 0, y: 0, rotate: 6, transition: { duration: 0.2, delay: 0.15 } },
    hover: { x: 22, y: -5, rotate: 15, scale: 1.1, transition: { duration: 0.16 } },
  },
} as const;

const RISE = {
  initial: { y: 12, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.2, delay: 0.1 } },
} as const;

type Slot = keyof typeof ICON_VARIANTS;
type Variant = "default" | "subtle" | "error";
type Size = "sm" | "default" | "lg";

const IconContainer = memo(({ children, slot, className }: { children: ReactNode; slot: Slot; className?: string }) => (
  <m.div
    variants={ICON_VARIANTS[slot]}
    className={cn(
      "relative flex size-12 items-center justify-center rounded-lg border border-border bg-muted transition-colors duration-(--motion-base) ease-desk group-hover:border-muted-foreground/40",
      className,
    )}
  >
    <div className="text-muted-foreground transition-colors duration-(--motion-base) group-hover:text-foreground [&_svg]:size-5">
      {children}
    </div>
  </m.div>
));
IconContainer.displayName = "IconContainer";

const SLOTS: readonly { slot: Slot; className: string }[] = [
  { slot: "left", className: "left-2 top-1 z-10" },
  { slot: "center", className: "z-20" },
  { slot: "right", className: "right-2 top-1 z-10" },
];

function MultiIconDisplay({ icons }: { icons: readonly ReactNode[] }) {
  if (icons.length < SLOTS.length) return null;
  return (
    <div className="relative isolate flex justify-center">
      {SLOTS.map(({ slot, className }, i) => (
        <IconContainer key={slot} slot={slot} className={className}>
          {icons[i]}
        </IconContainer>
      ))}
    </div>
  );
}

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "border-2 border-dashed border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/30",
  subtle: "border border-transparent bg-card hover:bg-muted/30",
  error: "border border-down/50 bg-down/10 hover:bg-down/15",
};

const SIZE_CLASSES: Record<Size, { box: string; title: string; description: string; button: string }> = {
  sm: { box: "p-6", title: "text-body", description: "text-caption", button: "px-3 py-1.5 text-caption" },
  default: { box: "p-8", title: "text-title", description: "text-body", button: "px-4 py-2 text-body" },
  lg: { box: "p-12", title: "text-num-md", description: "text-num-md", button: "px-6 py-3 text-num-md" },
};

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface EmptyStateProps extends Omit<HTMLMotionProps<"section">, "title" | "children" | "ref"> {
  title: ReactNode;
  description?: ReactNode;
  /** Exactly three icons fan out behind the title. */
  icons?: readonly ReactNode[];
  action?: EmptyStateAction;
  variant?: Variant;
  size?: Size;
  isIconAnimated?: boolean;
}

export const EmptyState = forwardRef<HTMLElement, EmptyStateProps>(
  (
    {
      title,
      description,
      icons,
      action,
      variant = "default",
      size = "default",
      isIconAnimated = true,
      className,
      ...props
    },
    ref,
  ) => {
    const titleId = useId();
    const descriptionId = useId();
    const sizes = SIZE_CLASSES[size];

    return (
      <LazyMotion features={domAnimation}>
        <m.section
          ref={ref}
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl text-center transition-colors duration-(--motion-slow) ease-desk",
            sizes.box,
            VARIANT_CLASSES[variant],
            className,
          )}
          initial="initial"
          animate="animate"
          whileHover={isIconAnimated ? "hover" : "animate"}
          {...props}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 0.125rem 0.125rem, var(--foreground) 0.0625rem, transparent 0.0625rem)",
              backgroundSize: "1.5rem 1.5rem",
            }}
          />
          <div className="relative z-10 flex flex-col items-center">
            {icons && (
              <div className="mb-6">
                <MultiIconDisplay icons={icons} />
              </div>
            )}

            <m.div variants={RISE} className="mb-6 space-y-2">
              <h2 id={titleId} className={cn(sizes.title, "font-semibold text-foreground")}>
                {title}
              </h2>
              {description && (
                <p
                  id={descriptionId}
                  className={cn(sizes.description, "max-w-md text-muted-foreground leading-relaxed")}
                >
                  {description}
                </p>
              )}
            </m.div>

            {action && (
              <m.div variants={RISE}>
                <m.button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "group/button relative inline-flex items-center gap-2 overflow-hidden rounded-md border border-border bg-secondary font-medium text-secondary-foreground transition-colors duration-(--motion-fast) ease-desk hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
                    sizes.button,
                  )}
                >
                  {action.icon && (
                    <span className="transition-transform duration-(--motion-slow) ease-desk group-hover/button:rotate-90 [&_svg]:size-4">
                      {action.icon}
                    </span>
                  )}
                  <span className="relative z-10">{action.label}</span>
                </m.button>
              </m.div>
            )}
          </div>
        </m.section>
      </LazyMotion>
    );
  },
);
EmptyState.displayName = "EmptyState";

export default EmptyState;
