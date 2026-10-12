"use client";
/**
 * Duel (S8.6, D-294; the web's `/app/duel/`, the phone's Duel screen): pick a tier and find an opponent (one passkey),
 * wait in the queue, get dealt the same three cards, swipe each Up or Down before the clock runs out, and watch the
 * cards settle into both totals — the better one takes the pot. Your duels and rating below.
 */
import { duelTiers } from "@senryo/calls";
import { type DuelFeel, useDuelFlow, useDuelMoments } from "@senryo/calls/react";
import { useProfile } from "@senryo/query";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { fire, music } from "@/lib/feedback";
import { celebrate } from "@/lib/feedback/celebrate";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { DuelHistory } from "./DuelHistory";
import { DuelMatch } from "./DuelMatch";
import { DuelQueue } from "./DuelQueue";
import { DuelTiers } from "./DuelTiers";

/** The web's feel for a duel's moments (D-317). */
const FEEL: DuelFeel = { fire, music, celebrate };

const DEFAULT_TIER = 1;

export function DuelScreen() {
  const account = useAccount();
  const [tier, setTier] = useState(DEFAULT_TIER);
  const [seen, setSeen] = useState<string | null>(null);
  const flow = useDuelFlow(account, {
    cue: (c) =>
      c === "filled" ? fire("filled", { cue: "open" }) : c === "fail" ? fire("fail", { cue: "error" }) : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to duel",
        description: "Your passkey is your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  useDuelMoments(flow, FEEL);
  const profile = useProfile(flow.owner);
  const avatar = "value" in profile ? (profile.value?.avatar ?? null) : null;
  const tiers = duelTiers(flow.chainId);
  const dismissed = flow.phase === "done" && flow.match?.matchId === seen;
  const showMatch = flow.match && flow.phase !== "idle" && flow.phase !== "queued" && !dismissed;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {flow.phase === "queued" && flow.entry ? (
            <DuelQueue
              tier={tiers.find((t) => t.id === flow.entry?.tier)}
              since={flow.entry.since}
              owner={flow.owner}
              avatar={avatar}
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
