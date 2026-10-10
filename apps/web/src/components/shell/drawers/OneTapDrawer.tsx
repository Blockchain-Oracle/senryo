"use client";
/**
 * One-tap calls (`?d=one-tap`; D-267, D-280): while this browser's capped key holds a live grant, calls need no prompt
 * — what is left, for how long, the per-call cap — and turning it off revokes it on chain (every outstanding signature
 * dies). Turning it on is one passkey prompt with the default caps; they are enforced by the pool, not this page.
 */
import { defaultOneTapTerms, useOneTap } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { useCatalog } from "@senryo/query";
import { Zap, ZapOff } from "lucide-react";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/drawer";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import type { DrawerProps } from "./types";

const DOLLAR_DECIMALS = 6;
const SECONDS_PER_MINUTE = 60;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, 0)}`;

export function OneTapDrawer({ open, onOpenChange }: DrawerProps) {
  const account = useAccount();
  const oneTap = useOneTap(account);
  const catalog = useCatalog();
  const terms = "value" in catalog ? defaultOneTapTerms(catalog.value.terms.session) : undefined;
  const s = oneTap.state;
  const act = async (on: boolean) => {
    fire("tick", { cue: "tap" });
    try {
      const r = on ? await oneTap.turnOn() : await oneTap.turnOff();
      if (r === "on") notify({ title: "One-tap is on", description: "Calls up to the caps need no prompt." });
      if (r === "off") notify({ title: "One-tap is off", description: "Each call asks for your passkey." });
    } catch (error) {
      notify({ title: "Couldn't change one-tap", description: (error as Error).message, tone: "warning" });
    }
  };
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="One-tap calls" description="Caps enforced on chain">
      {!account.hint ? (
        <SignInPrompt line="Sign in to turn on one-tap calls." className="pt-2" />
      ) : s.on ? (
        <div className="flex flex-col gap-4 pt-2">
          <p className="font-semibold text-title">On · {Math.ceil(s.secondsLeft / SECONDS_PER_MINUTE)} min left</p>
          <dl className="flex flex-col">
            {[
              ["Left to call", usd(s.left)],
              ["Each call up to", usd(s.perCallCap)],
              ["Session cap", usd(s.sessionCap)],
            ].map(([k, v]) => (
              <div key={k} className="flex min-h-12 items-center justify-between">
                <dt className="text-body text-text-2">{k}</dt>
                <dd className="font-semibold text-row-title tnum">{v}</dd>
              </div>
            ))}
          </dl>
          <Button variant="secondary" size="xl" disabled={oneTap.busy} onClick={() => void act(false)}>
            <ZapOff aria-hidden />
            {oneTap.busy ? "Turning off…" : "Turn off"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-body text-text-2">
            {terms
              ? `Calls up to ${usd(terms.perCallCap)} each, ${usd(terms.sessionCap)} in all, for ${Math.round(terms.seconds / SECONDS_PER_MINUTE)} minutes — no prompt each time.`
              : "Calls up to the caps, no prompt each time."}
          </p>
          <Button size="xl" disabled={oneTap.busy || !terms} onClick={() => void act(true)}>
            <Zap aria-hidden />
            {oneTap.busy ? "Turning on…" : terms ? "Turn on" : "Loading the caps…"}
          </Button>
        </div>
      )}
    </SlideOver>
  );
}
