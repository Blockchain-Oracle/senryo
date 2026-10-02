"use client";

/**
 * Practice starter funds (F05): one tap, the label follows the stage (Checking → Signing → Sending → Adding practice
 * dollars → Ready), no gas, clearly labelled PRACTICE · no real value. Every refusal names its reason and next step.
 */
import { type AuthFailure, authFailureCopy } from "@senryo/account";
import { formatUnits } from "@senryo/core";
import { Check, Coins, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { type StarterPhase, useStarter } from "@/lib/account/use-starter";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const USD_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_HOUR = 3_600;

const REASON: Record<string, string> = {
  RATE_LIMITED: "One claim per device per day",
  BUDGET_EXHAUSTED: "Today's practice budget is used up · try tomorrow",
  GEO_BLOCKED: "Not available in your region",
  RELAYER_BUSY: "The relay is busy · try again in a moment",
  NOT_DEPLOYED: "Starter funds aren't live on this network yet",
  UNREACHABLE: "The starter relay is offline right now · try again soon",
  SIGNATURE_INVALID: "The signature didn't verify · try again",
  SIGNATURE_EXPIRED: "The signature expired · try again",
  RELAY_REVERTED: "The claim didn't settle · nothing changed",
  UNKNOWN: "Something went wrong · try again",
};

function label(phase: StarterPhase): string {
  switch (phase.kind) {
    case "checking":
      return "Checking…";
    case "signing":
      return "Signing…";
    case "sending":
      return "Sending…";
    case "settling":
      // Monad commit states as the relay reports them: proposed → voted → finalized (the "Ready" below).
      return `Adding practice dollars · ${phase.relay.stage}…`;
    case "done":
      return "Ready";
    case "claimed":
      return "Claimed";
    default:
      return "Claim practice funds";
  }
}

function failureText(phase: Extract<StarterPhase, { kind: "failed" }>): string {
  if (phase.code === "AUTH") {
    const copy = authFailureCopy((phase.authKind ?? "unknown") as AuthFailure, "web");
    return `${copy.title}. ${copy.body}`;
  }
  const base = REASON[phase.code] ?? REASON.UNKNOWN ?? "";
  const hours = phase.retryAfterSec ? Math.ceil(phase.retryAfterSec / SECONDS_PER_HOUR) : undefined;
  return hours ? `${base} · next in ${hours}h` : base;
}

export function StarterPanel({ className, hideWhenClaimed }: { className?: string; hideWhenClaimed?: boolean }) {
  const { phase, claim, ready } = useStarter();
  if (hideWhenClaimed && phase.kind === "claimed") return null;
  const busy = ["checking", "signing", "sending", "settling"].includes(phase.kind);
  const finished = phase.kind === "done" || phase.kind === "claimed";
  return (
    <div className={cn("grid gap-2 rounded-sm border border-gold/40 bg-gold/5 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-caption">
          <Coins className="size-3.5 text-gold" aria-hidden />
          PRACTICE FUNDS
        </p>
        <span className="rounded-xs border border-gold/60 px-1.5 py-0.5 font-mono text-micro text-gold">
          NO REAL VALUE
        </span>
      </div>
      <p className="text-caption text-muted-foreground" aria-live="polite">
        {phase.kind === "done"
          ? `On the house · $${formatUnits(phase.creditUsd6, USD_DECIMALS, CENTS)} practice dollars and gas are in your account.`
          : phase.kind === "claimed"
            ? "Already claimed on this account · deposit more from Fund."
            : phase.kind === "failed"
              ? failureText(phase)
              : "Test dollars on Monad testnet plus gas, sent by our sponsor. You sign once — no fee."}
      </p>
      {finished ? (
        <Button asChild variant="outline">
          <Link href={phase.kind === "done" ? ROUTES.markets : ROUTES.addMoney}>
            <Check />
            {phase.kind === "done" ? "Trade gold" : "Add money"}
          </Link>
        </Button>
      ) : (
        <Button disabled={!ready || busy} onClick={() => void claim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Coins />}
          {phase.kind === "failed" ? "Try again" : label(phase)}
        </Button>
      )}
    </div>
  );
}
