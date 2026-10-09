"use client";
/**
 * Sign in or create an account without leaving the page (`?d=account`, D-190): the passkey actions — create (then
 * setup), sign in, continue as this device's account, recover with a backup — in the right drawer.
 */
import { WelcomeActions } from "@/components/auth/welcome-actions";
import { SlideOver } from "@/components/ui/drawer";
import { closeDrawer } from "@/lib/shell/drawer-param";
import type { DrawerProps } from "./types";

export function AccountDrawer({ open, onOpenChange }: DrawerProps) {
  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Your account"
      description="A passkey is your account: no seed phrase."
    >
      <div className="pt-2">
        <WelcomeActions onSignedIn={closeDrawer} />
      </div>
    </SlideOver>
  );
}
