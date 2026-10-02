"use client";

// 21st: preetsuthar17/selector-chips (#1963, as on the phone) — a wrap of selectable tiles, the selected one raised.
// Senryo: only the chains this asset has a route to (out) or from (in), each with its mark, name, time and provider; a
// chain with no live provider stays, dimmed, with its reason.
import type { BridgeRouteChain, BridgeRoutes } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import { type BridgeStatusRef, useBridgeStatus } from "@senryo/query";
import { Check, Loader2, X } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { known } from "@/components/ui/reading";
import { MARK_SMALL } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

const SEC_PER_MIN = 60;
const PROVIDER_NAME: Record<string, string> = {
  cctp: "Circle CCTP",
  relay: "Relay",
  across: "Across",
  lifi: "LI.FI",
  aurora: "Aurora",
};

/** "~2 s", "~3 min". */
export const etaText = (sec: number) =>
  sec < SEC_PER_MIN ? `~${Math.max(1, sec)} s` : `~${Math.round(sec / SEC_PER_MIN)} min`;
export const providerName = (provider: string) => PROVIDER_NAME[provider] ?? provider;
export const providerMark = (provider: string) => ids.provider(provider);

export function ChainGrid({
  routes,
  selected,
  onPick,
}: {
  routes: BridgeRoutes;
  selected: number | undefined;
  onPick: (chain: BridgeRouteChain) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {routes.chains.map((chain) => {
        const live = chain.providers.find((p) => p.available);
        const reason = chain.providers.find((p) => !p.available)?.reason;
        return (
          <button
            key={chain.chainId}
            type="button"
            disabled={!chain.available}
            aria-pressed={selected === chain.chainId}
            onClick={() => onPick(chain)}
            className={cn(
              "grid justify-items-start gap-1 rounded-md p-3 text-left disabled:opacity-40",
              selected === chain.chainId ? "bg-selected-row ring-1 ring-ring" : "bg-raised-2 hover:bg-row-pressed",
            )}
          >
            <EntityMark id={chain.mark} label={chain.name} size={MARK_SMALL} decorative />
            <span className="text-row">{chain.name}</span>
            <span className="text-meta text-text-3">
              {chain.available && live
                ? `${etaText(chain.etaSec ?? SEC_PER_MIN)} · ${providerName(live.provider)}`
                : (reason ?? "No route now")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type StepState = "done" | "live" | "waiting" | "failed";

/**
 * The cross-chain timeline (21st sean0205/vertical-titled-stepper #29815, as on the phone): Sent → Bridging →
 * Delivered (or Refunded / Didn't arrive), polled from `/v1/bridge/status` until it is terminal.
 */
export function BridgeTimeline({
  tracking,
  sent,
  destination,
}: {
  tracking: BridgeStatusRef | undefined;
  sent: boolean;
  destination: string;
}) {
  const value = known(useBridgeStatus(sent ? tracking : undefined));
  const state = value?.state;
  const terminal = state === "delivered" || state === "refunded" || state === "failed";
  const steps: { title: string; detail?: string | null | undefined; state: StepState }[] = [
    { title: "Sent", state: sent ? "done" : "live" },
    { title: "Bridging", state: !sent ? "waiting" : terminal ? (state === "delivered" ? "done" : "failed") : "live" },
    {
      title: state === "refunded" ? "Refunded" : state === "failed" ? "Didn’t arrive" : `Delivered on ${destination}`,
      state: state === "delivered" ? "done" : state === "refunded" || state === "failed" ? "failed" : "waiting",
      detail: value?.detail,
    },
  ];
  return (
    <ol aria-label={`Transfer to ${destination}`} className="grid gap-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-micro",
              s.state === "done" && "bg-up text-up-foreground",
              s.state === "failed" && "bg-down text-down-foreground",
              (s.state === "live" || s.state === "waiting") && "bg-raised-2 text-text-2",
            )}
          >
            {s.state === "done" ? (
              <Check className="size-3.5" />
            ) : s.state === "failed" ? (
              <X className="size-3.5" />
            ) : s.state === "live" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              i + 1
            )}
          </span>
          <span>
            <span className={cn("block text-row", s.state === "waiting" && "text-text-3")}>{s.title}</span>
            {s.detail ? <span className="block text-meta text-text-3">{s.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
