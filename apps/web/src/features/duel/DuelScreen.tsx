"use client";
/**
 * Duel as a two-seat arena (P4, D-322 … D-323; the phone's Duel — Codex's arena, Owarine's duel feel): the stage puts
 * you across from an empty opponent seat with the pot between; the tiers below with how many wait in each and the
 * commitment spelled out; one action finds an opponent (one passkey). Queued, the empty seat breathes as a search with
 * the time waited and the tier's queue — after half a minute the busier tiers are offered, never switched to. Matched,
 * the opponent takes the seat and the match plays on three market lanes. The ladder and your duels sit beside it.
 */
import { DUEL_QUIET_SEC, duelTiers, potLine, ratingText, tierTitle, waitingText } from "@senryo/calls";
import { type DuelFeel, useDuelFlow, useDuelMoments } from "@senryo/calls/react";
import { duelEntryCost } from "@senryo/config";
import { clockText, usdTidy } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useDuelWaiting } from "@senryo/query";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { fire, music } from "@/lib/feedback";
import { celebrate } from "@/lib/feedback/celebrate";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { DuelHistory, DuelLadder } from "./DuelBoard";
import { DuelMatch } from "./DuelMatch";
import { DuelStage } from "./DuelStage";
import { DuelTiers } from "./DuelTiers";

/** The web's feel for a duel's moments (D-317). */
const FEEL: DuelFeel = { fire, music, celebrate };
const DEFAULT_TIER = 1;
const MS_PER_SECOND = 1000;

export function DuelScreen() {
  const account = useAccount();
  const now = useServerSeconds();
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
  const waitingQuery = useDuelWaiting();
  const waiting = "value" in waitingQuery ? waitingQuery.value : undefined;
  const tiers = duelTiers(flow.chainId);
  const chosen = tiers.find((t) => t.id === tier) ?? tiers[0];
  const cost = chosen ? duelEntryCost(chosen) : 0n;
  const rating = ratingText(flow.rating);
  const dismissed = flow.phase === "done" && flow.match?.matchId === seen;
  const inMatch = flow.match !== null && flow.phase !== "idle" && flow.phase !== "queued" && !dismissed;
  const queued = flow.phase === "queued" && flow.entry !== null;
  const short = flow.balance !== undefined && flow.balance < cost;
  const why = !flow.live ? "Duels aren't open yet" : short ? "Not enough dollars for this duel" : null;
  const waited = queued && flow.entry ? Math.max(0, now - Math.floor(Date.parse(flow.entry.since) / MS_PER_SECOND)) : 0;
  const queuedTier = queued ? tiers.find((t) => t.id === flow.entry?.tier) : undefined;
  const stageTier = queuedTier ?? chosen;
  const count = (id: number) => (waiting ? (waiting.get(id) ?? 0) : undefined);
  const busier =
    queued && waited >= DUEL_QUIET_SEC ? tiers.filter((t) => t.id !== queuedTier?.id && (count(t.id) ?? 0) > 0) : [];
  const switchTo = async (id: number) => {
    fire("tick", { cue: "tap" });
    // Joins the new tier only once the old queue is left: never queued twice (D3).
    if (!(await flow.cancel())) return;
    setTier(id);
    await flow.enter(id);
  };
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        {inMatch ? (
          <DuelMatch
            flow={flow}
            rating={rating}
            onRematch={(t) => {
              setTier(t);
              void flow.enter(t);
            }}
            onDone={() => setSeen(flow.match?.matchId ?? null)}
          />
        ) : (
          <>
            <DuelStage
              me={flow.owner}
              rating={rating}
              opponent={
                queued
                  ? {
                      kind: "searching",
                      line: `Searching · ${clockText(waited)}`,
                      detail: waitingText(queuedTier ? count(queuedTier.id) : undefined),
                    }
                  : { kind: "empty" }
              }
              pot={stageTier ? potLine(stageTier) : "—"}
            >
              <p className="text-center text-meta opacity-80">
                {queued
                  ? `${queuedTier ? tierTitle(queuedTier) : "Duel"} · the same three cards for both of you`
                  : "Three calls each on the same cards · the better total takes the pot"}
              </p>
            </DuelStage>
            {queued ? (
              <div className="flex flex-col gap-3">
                {busier.length > 0 ? (
                  <section aria-label="Busier tiers" className="flex flex-col gap-2">
                    <p className="text-meta text-text-3">Quiet here. Others are waiting in:</p>
                    {busier.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void switchTo(t.id)}
                        className="flex min-h-13 items-center gap-3 rounded-2xl bg-secondary px-4 text-left hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="flex-1 font-semibold text-row-title">{tierTitle(t)}</span>
                        <span className="text-meta text-text-3">{waitingText(count(t.id))}</span>
                        <span className="font-semibold text-link text-row-title">Switch</span>
                      </button>
                    ))}
                  </section>
                ) : null}
                <button
                  type="button"
                  onClick={() => void flow.cancel()}
                  className="h-14 rounded-full bg-secondary font-semibold text-button focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Leave the queue
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <DuelTiers tiers={tiers} value={chosen?.id ?? tier} onChange={setTier} waiting={waiting} />
                {(flow.busy ?? why) ? (
                  <p role="status" className="text-meta text-text-3">
                    {flow.busy ?? why}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={why !== null || flow.busy !== null}
                  onClick={() => void flow.enter(chosen?.id ?? tier)}
                  className="h-14 rounded-full bg-primary font-semibold text-button text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  Find opponent · {usdTidy(cost)}
                </button>
              </div>
            )}
            {flow.entry?.state === "failed" || flow.entry?.state === "lapsed" ? (
              <p className="text-meta text-text-3" role="status">
                {flow.entry.state === "lapsed"
                  ? "Nobody joined in time · nothing was taken"
                  : `Couldn't start · ${flow.entry.reason ?? "nothing was taken"}`}
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="flex flex-col gap-8 lg:sticky lg:top-6 lg:self-start">
        <DuelLadder me={flow.owner} rating={flow.rating} />
        <DuelHistory me={flow.owner} duels={flow.history} />
      </div>
    </div>
  );
}
