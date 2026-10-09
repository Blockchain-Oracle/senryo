"use client";
/** A call's receipt in the wide right drawer (`?d=call&id=<ticketId>`, D-190): Back closes it, a link opens it. */
import { useQueryEnv } from "@senryo/query";
import { SlideOver } from "@/components/ui/drawer";
import { CallReceipt } from "@/features/calls/CallReceipt";
import { useDrawerArg } from "@/lib/shell/drawer-param";
import type { DrawerProps } from "./types";

const TICKET_ID = /^\d{1,78}$/;

export function CallDrawer({ open, onOpenChange }: DrawerProps) {
  const { chainId } = useQueryEnv();
  const id = useDrawerArg("id");
  const ticketId = id && TICKET_ID.test(id) ? BigInt(id) : null;
  return (
    <SlideOver open={open && ticketId !== null} onOpenChange={onOpenChange} title="Receipt" hideHeading wide>
      {ticketId !== null ? <CallReceipt ticketId={ticketId} chainId={chainId} /> : null}
    </SlideOver>
  );
}
