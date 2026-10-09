"use client";

/**
 * The centred modal (D-190: web overlays are right drawers and centred modals, never bottom sheets) over the installed
 * shadcn Dialog (21st, `./dialog`): the same at every width. `locked` blocks dismissal while a passkey ceremony runs
 * (the OS sheet owns the screen).
 */
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  locked?: boolean;
}

export function Modal({ open, onOpenChange, title, description, children, footer, locked }: ModalProps) {
  const change = (next: boolean) => {
    if (!locked || next) onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent hideClose={locked === true} {...(description ? {} : { "aria-describedby": undefined })}>
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
