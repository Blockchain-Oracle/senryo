"use client";
/**
 * One ride's receipt (R5.11, D-331): its slip — folio, the realised result and its stamp (closed up or down, knocked
 * out, capped, ended), margin, leverage, entry and exit — with its row of actions (D-352): Replay ▶ for a finished ride,
 * Live for an open one (the terminal), Post, Share, Save.
 * `publicView` is the shared link's page: no account needed.
 */
import { rideFigure, rideFilm, rideKey, rideLink, rideSlip } from "@senryo/calls";
import { type ChainId, networkOf } from "@senryo/config";
import { useRide } from "@senryo/query";
import { Activity } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionCircle } from "@/components/ui/action-circle";
import { Button } from "@/components/ui/button";
import { ReplayAction } from "@/features/replay/ReplayAction";
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
  const router = useRouter();
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
  const live = (
    <ActionCircle icon={<Activity aria-hidden />} label="Live" primary onClick={() => router.push(terminal)} />
  );
  const replay = (
    <ReplayAction
      chainId={chainId}
      bookKey={rideKey(r.rideId)}
      url={slip.url}
      build={(episode) => rideFilm(r, episode, { practice: networkOf(chainId).modeLabel === "Practice" })}
    />
  );
  return (
    <div className="flex flex-col items-start gap-6">
      {slip.live && !publicView ? (
        <LiveShareSlip slip={slip} entryKey={rideKey(r.rideId)} side={side} lead={live} />
      ) : (
        <ShareSlip slip={slip} figure={slip.live ? null : rideFigure(r)} side={side} lead={slip.live ? null : replay} />
      )}
      {publicView ? (
        <Button asChild size="xl" variant={slip.live ? "default" : "secondary"}>
          <Link href={terminal}>Ride {r.symbol} yourself</Link>
        </Button>
      ) : null}
    </div>
  );
}
