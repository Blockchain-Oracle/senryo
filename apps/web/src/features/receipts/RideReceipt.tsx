"use client";
/**
 * One ride's receipt (R5.11, D-331): its slip — folio, the realised result and its stamp (closed up or down, knocked
 * out, capped, ended), margin, leverage, size, entry and exit, knock-out and cap, fees and what came back — shared with
 * PnL · ROI · Both (R5.21), open or ended, with the transaction that ended it. A live ride opens the terminal.
 * `publicView` is the shared link's page: no account needed.
 */
import { rideFigure, rideFilm, rideKey, rideLink, rideSlip } from "@senryo/calls";
import { type ChainId, networkOf } from "@senryo/config";
import { useRide } from "@senryo/query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReplayVideo } from "@/features/replay/ReplayVideo";
import { LiveShareSlip, ShareSlip } from "./ShareSlip";

export function RideReceipt({
  rideId,
  chainId,
  publicView = false,
}: {
  rideId: bigint;
  chainId: ChainId;
  publicView?: boolean;
}) {
  const ride = useRide(rideId, chainId);
  if (!("value" in ride)) {
    return (
      <p className="text-body text-text-3">
        {ride.status === "failed"
          ? "This ride isn't here. It appears a few seconds after it opens."
          : "Loading the ride…"}
      </p>
    );
  }
  const r = ride.value.ride;
  const slip = rideSlip(r, {
    chainId,
    practice: networkOf(chainId).modeLabel === "Practice",
    url: rideLink(r.rideId, chainId),
  });
  const terminal = `/app/trade/${r.symbol.toLowerCase()}/`;
  const side = r.isLong ? "Up" : "Down";
  return (
    <div className="flex flex-col items-start gap-4">
      {slip.live && !publicView ? (
        <LiveShareSlip slip={slip} entryKey={rideKey(r.rideId)} side={side} />
      ) : (
        <ShareSlip slip={slip} figure={slip.live ? null : rideFigure(r)} side={side} />
      )}
      {slip.live ? null : (
        <ReplayVideo
          chainId={chainId}
          bookKey={rideKey(r.rideId)}
          url={slip.url}
          build={(episode) => rideFilm(r, episode, { practice: networkOf(chainId).modeLabel === "Practice" })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {slip.live && !publicView ? (
          <Button asChild size="xl" variant="secondary">
            <Link href={terminal}>Watch it live</Link>
          </Button>
        ) : null}
        {publicView ? (
          <Button asChild size="xl" variant={slip.live ? "default" : "secondary"}>
            <Link href={terminal}>Ride {r.symbol} yourself</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
