"use client";

// 21st: originui/slider (#304) — https://21st.dev/@originui/components/slider
// D2 re-tokenized: 4-unit hairline track on --secondary, --primary range, ring thumb on --background.
// Adds: `thumbLabel` (aria-label per thumb), optional `detents` (quick-set stops shown under the track, e.g. 1/2/5/10×)
// and fixes the original prop-spread order that swallowed its own onValueChange.
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  type ComponentPropsWithoutRef,
  type ComponentRef,
  Fragment,
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PERCENT = 100;
/** Detent labels closer than this (% of track) collapse to a tick so they never overlap. */
const MIN_LABEL_GAP_PCT = 14;
/** Labels this close to an end align inward instead of overhanging the track. */
const EDGE_PCT = 6;

type SliderProps = ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  showTooltip?: boolean;
  tooltipContent?: (value: number) => ReactNode;
  /** Accessible name for each thumb (e.g. "Leverage"). */
  thumbLabel?: string;
  /** Quick-set stops rendered as buttons under the track. */
  detents?: readonly number[];
  formatDetent?: (value: number) => ReactNode;
};

const Slider = forwardRef<ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  (
    {
      className,
      showTooltip = false,
      tooltipContent,
      thumbLabel,
      detents,
      formatDetent = (v) => v,
      onValueChange,
      value,
      defaultValue,
      min = 0,
      max = PERCENT,
      ...props
    },
    ref,
  ) => {
    const [showTooltipState, setShowTooltipState] = useState(false);
    const [internalValue, setInternalValue] = useState<number[]>(value ?? defaultValue ?? [min]);

    useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);

    const handleValueChange = (next: number[]) => {
      setInternalValue(next);
      onValueChange?.(next);
    };

    const handlePointerUp = useCallback(() => {
      if (showTooltip) setShowTooltipState(false);
    }, [showTooltip]);

    useEffect(() => {
      if (!showTooltip) return;
      document.addEventListener("pointerup", handlePointerUp);
      return () => document.removeEventListener("pointerup", handlePointerUp);
    }, [showTooltip, handlePointerUp]);

    const renderThumb = (thumbValue: number) => {
      const thumb = (
        <SliderPrimitive.Thumb
          aria-label={thumbLabel}
          className="block size-5 rounded-full border-2 border-primary bg-background transition-colors duration-(--motion-fast) ease-desk focus-visible:outline-3 focus-visible:outline-ring/40 data-disabled:cursor-not-allowed"
          onPointerDown={() => showTooltip && setShowTooltipState(true)}
        />
      );
      if (!showTooltip) return thumb;
      return (
        <TooltipProvider>
          <Tooltip open={showTooltipState}>
            <TooltipTrigger asChild>{thumb}</TooltipTrigger>
            <TooltipContent sideOffset={8} side={props.orientation === "vertical" ? "right" : "top"}>
              <p>{tooltipContent ? tooltipContent(thumbValue) : thumbValue}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    };

    const root = (
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        className={cn(
          "relative flex min-h-6 w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-disabled:opacity-50",
          className,
        )}
        onValueChange={handleValueChange}
        {...props}
      >
        <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-secondary data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2">
          <SliderPrimitive.Range className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
        </SliderPrimitive.Track>
        {internalValue.map((v, index) => (
          <Fragment key={index}>{renderThumb(v)}</Fragment>
        ))}
      </SliderPrimitive.Root>
    );

    if (!detents?.length) return root;
    const span = max - min || 1;
    let lastLabelled = Number.NEGATIVE_INFINITY;
    const stops = detents.map((d) => {
      const pos = ((d - min) / span) * PERCENT;
      const labelled = pos - lastLabelled >= MIN_LABEL_GAP_PCT;
      if (labelled) lastLabelled = pos;
      return { d, pos, labelled };
    });
    return (
      <div className="w-full">
        {root}
        <div className="relative mt-1 h-6">
          {stops.map(({ d, pos, labelled }) => {
            const active = internalValue[0] === d;
            const align =
              pos < EDGE_PCT ? "translate-x-0" : pos > PERCENT - EDGE_PCT ? "-translate-x-full" : "-translate-x-1/2";
            return (
              <button
                key={d}
                type="button"
                aria-label={`${thumbLabel ?? "Value"} ${d}`}
                onClick={() => handleValueChange([d])}
                className={cn(
                  "absolute top-0 flex h-6 min-w-3 items-start justify-center rounded-sm font-mono text-micro tnum transition-colors duration-(--motion-fast) ease-desk hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  align,
                  active ? "text-primary" : "text-muted-foreground",
                )}
                style={{ left: `${pos}%` }}
              >
                {labelled ? formatDetent(d) : <span aria-hidden className="mt-0.5 h-1.5 w-px bg-current" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
