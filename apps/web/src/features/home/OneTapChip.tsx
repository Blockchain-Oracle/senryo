"use client";
/**
 * The session chip (the phone's `OneTapChip`): "One-tap on · 12 min · $76 left" while this browser's capped key is
 * live, else "Turn on one-tap calls". Turning it on or off is one passkey prompt; the caps are enforced on chain.
 */
import { useOneTap } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const DOLLAR_DECIMALS = 6;
const SECONDS_PER_MINUTE = 60;

export function OneTapChip() {
  const oneTap = useOneTap(useAccount());
  const s = oneTap.state;
  const label = s.on
    ? `One-tap on · ${Math.ceil(s.secondsLeft / SECONDS_PER_MINUTE)} min · $${formatUnits(s.left, DOLLAR_DECIMALS, 0)} left`
    : "Turn on one-tap calls";
  return (
    <button
      type="button"
      disabled={oneTap.busy}
      aria-label={s.on ? `${label}. Turn off` : label}
      className={cn(
        "self-start rounded-full px-4 py-2 font-semibold text-meta focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
        s.on ? "bg-up-surface text-up" : "bg-secondary text-foreground",
      )}
      onClick={async () => {
        fire("tick", { cue: "tap" });
        try {
          if (s.on) await oneTap.turnOff();
          else await oneTap.turnOn();
        } catch (error) {
          notify({ title: "Couldn't change one-tap", description: (error as Error).message, tone: "warning" });
        }
      }}
    >
      {oneTap.busy ? "One moment…" : label}
    </button>
  );
}
