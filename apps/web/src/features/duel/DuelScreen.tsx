"use client";
/**
 * Duel (S8.6, D-294; the web's `/app/duel/`, the phone's Duel screen): pick a tier and find an opponent (one passkey),
 * wait in the queue, get dealt the same three cards, swipe each Up or Down before the clock runs out, and watch the
 * cards settle into both totals — the better one takes the pot. Your duels and rating below.
 */
import { duelTiers, tierTitle } from "@senryo/calls";
import { useDuelFlow } from "@senryo/calls/react";
import { clockText } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { DuelHistory } from "./DuelHistory";
import { DuelMatch } from "./DuelMatch";
import { DuelTiers } from "./DuelTiers";

const DEFAULT_TIER = 1;
const MS_PER_SECOND = 1000;

export function DuelScreen() {
  const account = useAccount();
  const [tier, setTier] = useState(DEFAULT_TIER);
  const [seen, setSeen] = useState<string | null>(null);
  const flow = useDuelFlow(account, {
    cue: (c) => (c === "filled" ? fire("filled", { cue: "open" }) : fire(c)),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to duel",
        description: "Your passkey is your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  const tiers = duelTiers(flow.chainId);
  const dismissed = flow.phase === "done" && flow.match?.matchId === seen;
  const showMatch = flow.match && flow.phase !== "idle" && flow.phase !== "queued" && !dismissed;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {flow.phase === "queued" && flow.entry ? (
            <Queue
              tier={tiers.find((t) => t.id === flow.entry?.tier)}
              since={flow.entry.since}
              onCancel={() => void flow.cancel()}
            />
          ) : showMatch ? (
            <DuelMatch flow={flow} onAgain={() => setSeen(flow.match?.matchId ?? null)} />
          ) : (
            <DuelTiers
              tiers={tiers}
              tier={tier}
              onTier={setTier}
              onEnter={() => void flow.enter(tier)}
              live={flow.live}
              busy={flow.busy}
              balance={flow.balance}
            />
          )}
          {flow.entry?.state === "failed" || flow.entry?.state === "lapsed" ? (
            <p className="text-meta text-text-3" role="status">
              {flow.entry.state === "lapsed"
                ? "Nobody joined in time · nothing was taken"
                : `Couldn't start · ${flow.entry.reason ?? "nothing was taken"}`}
            </p>
          ) : null}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <DuelHistory chainId={flow.chainId} owner={flow.owner} duels={flow.history} rating={flow.rating} />
        </div>
      </div>
    </div>
  );
}

function Queue(p: { tier: ReturnType<typeof duelTiers>[number] | undefined; since: string; onCancel: () => void }) {
  const now = useServerSeconds();
  const waited = Math.max(0, now - Math.floor(Date.parse(p.since) / MS_PER_SECOND));
  return (
    <section aria-label="Finding an opponent" className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-section-title">Finding an opponent…</h2>
        <span className="tnum text-meta text-text-2">
          {p.tier ? tierTitle(p.tier) : "Duel"} · waiting {clockText(waited)}
        </span>
      </div>
      <button
        type="button"
        onClick={p.onCancel}
        className="h-14 rounded-xl bg-secondary font-semibold text-button transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring"
      >
        Leave the queue
      </button>
    </section>
  );
}
