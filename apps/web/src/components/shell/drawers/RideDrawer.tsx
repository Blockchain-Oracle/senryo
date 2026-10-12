"use client";
/** A ride's receipt in the wide right drawer (`?d=ride&id=<rideId>`, as a call's): Back closes it, a link opens it. */
import { useQueryEnv } from "@senryo/query";
import { SlideOver } from "@/components/ui/drawer";
import { RideReceipt } from "@/features/receipts/RideReceipt";
import { useDrawerArg } from "@/lib/shell/drawer-param";
import type { DrawerProps } from "./types";

const RIDE_ID = /^\d{1,78}$/;

export function RideDrawer({ open, onOpenChange }: DrawerProps) {
  const { chainId } = useQueryEnv();
  const id = useDrawerArg("id");
  const rideId = id && RIDE_ID.test(id) ? BigInt(id) : null;
  return (
    <SlideOver open={open && rideId !== null} onOpenChange={onOpenChange} title="Receipt" hideHeading wide>
      {rideId !== null ? <RideReceipt rideId={rideId} chainId={chainId} /> : null}
    </SlideOver>
  );
}
