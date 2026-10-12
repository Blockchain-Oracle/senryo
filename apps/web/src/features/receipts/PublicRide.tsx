"use client";
/** A shared ride's public receipt (`/ride?id=&chainId=`, the slip's link): read without an account. */
import { PublicQuery } from "@/components/public/public-query";
import { RideReceipt } from "./RideReceipt";

const RIDE_ID = /^\d{1,78}$/;

export function PublicRide() {
  return (
    <PublicQuery loading="Loading the ride…">
      {(chainId, params) => {
        const id = params.get("id") ?? "";
        if (!RIDE_ID.test(id) || !params.get("chainId"))
          return <p className="text-body text-text-2">This link doesn't name a ride. Ask for the link again.</p>;
        return <RideReceipt rideId={BigInt(id)} chainId={chainId} publicView />;
      }}
    </PublicQuery>
  );
}
