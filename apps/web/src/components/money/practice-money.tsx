"use client";

/**
 * Practice money (flow book B15; the phone's PracticeMoneyCard / PracticePanel): the one-time P$ claim, signed once with
 * the session (no fee — the sponsor relays it), its stage in the second line, and a refusal named with its reason. A
 * signed claim is never re-sent by itself; a claim found mid-relay after a reload is followed, not re-signed.
 */
import { type AuthFailure, authFailureCopy } from "@senryo/account";
import { collateralId } from "@senryo/identity";
import { Check, Gift, Loader2 } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ListRow } from "@/components/kit/list-row";
import { Button } from "@/components/ui/button";
import { type StarterPhase, useStarter } from "@/lib/account/use-starter";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_ROW } from "@/lib/constants/brand";
import { money } from "@/lib/format";

const SECONDS_PER_HOUR = 3_600;

const REASON: Record<string, string> = {
  RATE_LIMITED: "One claim per device per day",
  BUDGET_EXHAUSTED: "Today’s budget is used up",
  GEO_BLOCKED: "Not available in your region",
  RELAYER_BUSY: "Relay busy · try again",
  NOT_DEPLOYED: "Not live on this network",
  UNREACHABLE: "Relay offline · try again soon",
  SIGNATURE_INVALID: "Signature didn’t verify · try again",
  SIGNATURE_EXPIRED: "Signature expired · try again",
  RELAY_REVERTED: "Didn’t settle · nothing changed",
  UNKNOWN: "Didn’t go through · try again",
};

function failureText(phase: Extract<StarterPhase, { kind: "failed" }>): string {
  if (phase.code === "AUTH") return authFailureCopy((phase.authKind ?? "unknown") as AuthFailure, "web").title;
  const base = REASON[phase.code] ?? REASON.UNKNOWN ?? "";
  const hours = phase.retryAfterSec ? Math.ceil(phase.retryAfterSec / SECONDS_PER_HOUR) : undefined;
  return hours ? `${base} · next in ${hours}h` : base;
}

export function claimLine(phase: StarterPhase): { title: string; detail: string; busy: boolean } {
  switch (phase.kind) {
    case "signing":
    case "sending":
      return { title: "Get practice money", detail: "Signing…", busy: true };
    case "settling":
      return { title: "Get practice money", detail: `Adding · ${phase.relay.stage}…`, busy: true };
    case "checking":
      return { title: "Get practice money", detail: "Checking…", busy: true };
    case "done":
      return { title: `${money(phase.creditUsd6)} added`, detail: "In your Assets", busy: false };
    case "claimed":
      return { title: "Claimed", detail: "In your Assets", busy: false };
    case "failed":
      return { title: "Get practice money", detail: failureText(phase), busy: false };
    default:
      return { title: "Get practice money", detail: "Free · once", busy: false };
  }
}

/** Home's first-action card: shown until the claim is done (then the money is in Assets and the card goes). */
export function PracticeMoneyCard() {
  const { phase, claim, ready } = useStarter();
  // Nothing to do (claimed) or not known yet (checking): no card, so a claimed account never sees it flash.
  if (phase.kind === "claimed" || phase.kind === "checking") return null;
  const line = claimLine(phase);
  if (phase.kind === "done") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-md bg-up-surface px-4 py-3 text-row text-up" role="status">
        <Check className="size-5" aria-hidden /> {line.title} · {line.detail}
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-center gap-3 rounded-md bg-raised-2 px-4 py-3">
      <EntityMark id={collateralId(ACTIVE_NETWORK.chainId, "AUSD")} size={MARK_ROW} decorative />
      <div className="min-w-0 flex-1">
        <p className="text-row">{line.title}</p>
        <p className="truncate text-meta text-text-2" aria-live="polite">
          {line.detail}
        </p>
      </div>
      <Button size="sm" disabled={!ready || line.busy} onClick={() => void claim()} className="rounded-full font-sans">
        {line.busy ? <Loader2 className="animate-spin" /> : <Gift />}
        {phase.kind === "failed" ? "Try again" : "Claim"}
      </Button>
    </div>
  );
}

/** The Add money row (the phone's PracticePanel first row). */
export function PracticeMoneyRow() {
  const { phase, claim, ready } = useStarter();
  const line = claimLine(phase);
  const finished = phase.kind === "done" || phase.kind === "claimed";
  return (
    <ListRow
      leading={<EntityMark id={collateralId(ACTIVE_NETWORK.chainId, "AUSD")} size={MARK_ROW} decorative />}
      title={line.title}
      subtitle={line.detail}
      {...(finished || line.busy || !ready ? {} : { onClick: () => void claim() })}
      trailing={
        line.busy ? (
          <Loader2 className="size-4 animate-spin text-text-2" aria-hidden />
        ) : finished ? (
          <Check className="size-4 text-up" aria-hidden />
        ) : null
      }
    />
  );
}
