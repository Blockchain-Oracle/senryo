import { useResults } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { EntityMark } from "~/components/identity/EntityMark";
import { celebrate } from "~/feedback/celebrate";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";
import { SIZE } from "~/theme";

/**
 * Results land wherever you are: the shared rules (`@senryo/calls` `useResults`) with the phone's effects — the win
 * cue and haptic, the soft thud for a loss, confetti, and the toast with the market's mark (R2.8).
 */
export function ResultHost() {
  useResults(useAccount(), {
    cue: (c) =>
      c === "win" ? fire("win", { cue: "win" }) : c === "loss" ? fire("loss", { cue: "loss" }) : fire("confirm"),
    celebrate,
    notify: ({ symbol, ...n }) =>
      notify({ ...n, icon: <EntityMark id={marketId(symbol)} size={SIZE.markInline} decorative /> }),
  });
  return null;
}
