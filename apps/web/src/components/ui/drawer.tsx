"use client";

// From 21st.dev 31360 wensity/drawer via Mitoshi `components/ui/drawer.tsx` (D-190: web overlays are right drawers and
// centred modals, never bottom sheets). Changed for Senryo: Radix Dialog (already the modal's primitive) instead of
// Base UI, so one dialog library ships; the swipe-to-close Base UI gave is a small pointer handler (touch only, axis
// locked); motion and sizes are tokens in `styles/drawer.css`.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef } from "react";
import { cn } from "@/lib/utils";

/** A swipe closes past this share of the drawer's width, or faster than this (px per ms). */
const SWIPE_CLOSE_SHARE = 0.3;
const SWIPE_CLOSE_SPEED = 0.5;
/** Movement before the swipe decides between a horizontal drag and a scroll. */
const SWIPE_SLOP = 10;
const COARSE_POINTER = "(pointer: coarse)";

function useSwipeClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; locked: boolean | null } | null>(null);
  const reset = (el: HTMLDivElement) => {
    el.style.transform = "";
    el.removeAttribute("data-swiping");
  };
  return {
    ref,
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, locked: null };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      const el = ref.current;
      if (!d || !el) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.locked === null && Math.hypot(dx, dy) > SWIPE_SLOP) d.locked = Math.abs(dx) > Math.abs(dy) && dx > 0;
      if (!d.locked) return;
      el.setAttribute("data-swiping", "");
      el.style.transform = `translateX(${Math.max(0, dx)}px)`;
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      const el = ref.current;
      drag.current = null;
      if (!d?.locked || !el) return;
      const dx = e.clientX - d.x;
      const speed = dx / Math.max(1, e.timeStamp - d.t);
      reset(el);
      if (dx > el.offsetWidth * SWIPE_CLOSE_SHARE || speed > SWIPE_CLOSE_SPEED) onClose();
    },
    onPointerCancel: () => {
      drag.current = null;
      if (ref.current) reset(ref.current);
    },
  };
}

export interface SlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Visually hide the heading when the body carries its own (the title stays for assistive tech). */
  hideHeading?: boolean;
  /** The wide drawer (560): a receipt, a table. */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

/** The right-edge drawer: swipe right, press Escape or tap outside to close; focus trap and scroll lock from Radix. */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  hideHeading = false,
  wide = false,
  className,
  children,
}: SlideOverProps) {
  const swipe = useSwipeClose(() => onOpenChange(false));
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="slide-over-backdrop" />
        <DialogPrimitive.Content
          ref={swipe.ref}
          className={cn("slide-over-popup", wide && "is-wide", className)}
          onPointerDown={swipe.onPointerDown}
          onPointerMove={swipe.onPointerMove}
          onPointerUp={swipe.onPointerUp}
          onPointerCancel={swipe.onPointerCancel}
          onOpenAutoFocus={(event) => {
            // On a touch screen a focused field raises the keyboard over the drawer: focus the drawer itself instead.
            if (!window.matchMedia(COARSE_POINTER).matches) return;
            event.preventDefault();
            swipe.ref.current?.focus();
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className={cn("slide-over-head", hideHeading && "sr-only")}>
            <DialogPrimitive.Title className="text-sheet-title font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-meta text-text-2">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          <div className="slide-over-body">{children}</div>
          <DialogPrimitive.Close className="slide-over-close" aria-label="Close">
            <X aria-hidden className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
