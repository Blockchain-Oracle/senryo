"use client";

// shadcn/tooltip (originui variant, dependency of 21st originui/slider #304). D2: popover surface, hairline, caption type.
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = forwardRef<
  ComponentRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { showArrow?: boolean }
>(({ className, sideOffset = 4, showArrow = false, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "relative z-50 max-w-72 rounded-lg border border-border bg-popover px-2 py-1 font-mono text-caption text-popover-foreground tnum animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      {children}
      {showArrow && <TooltipPrimitive.Arrow className="-my-px fill-popover" />}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
export default Tooltip;
