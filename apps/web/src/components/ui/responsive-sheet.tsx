"use client";

/**
 * One sheet API over the two 21st primitives the spec assigns by width (client.md): vaul Drawer on phone widths,
 * Dialog on the ≥1024 desk. Layout glue only — both surfaces are the installed 21st/shadcn components.
 */
import { type ReactNode, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "./drawer";

// Tailwind `lg` (64rem = the desk breakpoint, plan §2.4).
const DESK_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useDesk(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESK_QUERY).matches,
    () => false,
  );
}

export interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Blocks dismissal while a ceremony runs (the OS sheet owns the screen). */
  locked?: boolean;
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  locked,
}: ResponsiveSheetProps) {
  const desk = useDesk();
  const change = (next: boolean) => {
    if (!locked || next) onOpenChange(next);
  };
  if (desk) {
    return (
      <Dialog open={open} onOpenChange={change}>
        <DialogContent hideClose={locked === true}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={change} dismissible={!locked}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        {children ? <div className="px-4">{children}</div> : null}
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  );
}
