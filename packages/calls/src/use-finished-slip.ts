/**
 * A just-finished trade's slip (R5.11, `trade-run.ts`): its call's timeline or its ride read once more, as the slip the
 * receipt shows — so the paper under "Just finished" is the receipt itself, with its stamp.
 */
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { useCallTimeline, useQueryEnv, useRide } from "@senryo/query";
import { callLink } from "./links.ts";
import type { FinishedTrade } from "./trade-run.ts";
import { callSlip, rideLink, rideSlip, type TradeSlip } from "./trade-slip.ts";

export function useFinishedSlip(run: Pick<FinishedTrade, "instrument" | "id"> | undefined): TradeSlip | null {
  const env = useQueryEnv();
  const practice = env.chainId === TESTNET_CHAIN_ID;
  const call = useCallTimeline(run?.instrument === "call" ? run.id : undefined);
  const ride = useRide(run?.instrument === "ride" ? run.id : undefined);
  if (!run) return null;
  if (run.instrument === "call")
    return "value" in call
      ? callSlip(call.value, { chainId: env.chainId, practice, url: callLink(run.id, env.chainId) })
      : null;
  return "value" in ride
    ? rideSlip(ride.value.ride, { chainId: env.chainId, practice, url: rideLink(run.id, env.chainId) })
    : null;
}
