"use client";
/**
 * Results land wherever you are in the app: the shared rules (`@senryo/calls` `useResults`, the phone's own) with the
 * web's effects — the win cue and haptic, the loss thud, confetti, and the toast with the market's mark (R2.8).
 */
import { useResults } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { celebrate } from "@/lib/feedback/celebrate";
import { notify } from "@/lib/notify";

const MARK = 20;

export function ResultHost() {
  useResults(useAccount(), {
    cue: (c) =>
      c === "win" ? fire("win", { cue: "win" }) : c === "loss" ? fire("loss", { cue: "loss" }) : fire("confirm"),
    celebrate,
    notify: ({ symbol, ...n }) => notify({ ...n, icon: <EntityMark id={marketId(symbol)} size={MARK} decorative /> }),
  });
  return null;
}
