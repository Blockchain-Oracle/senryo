"use client";
/**
 * A dealt duel (P4, D-322; the phone's `DuelMatch`): the stage keeps both seats with each running total and the pot;
 * while the deck is sealed it says so; while picks are open the clock drains (21st Progress Bar #23549) and the stage
 * beats through the last ten seconds; then the three market lanes. When it's over the verdict takes the stage. The
 * sealed deck's commitment and the revealed seed sit at the foot.
 */
import { clockTone, opponentOf, potLine, seatOf, seatTotal } from "@senryo/calls";
import { type DuelFlow, useDuelCardQuotes } from "@senryo/calls/react";
import { DUEL } from "@senryo/config";
import { clockText, shortAddress } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useProfile } from "@senryo/query";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DuelLanes } from "./DuelLanes";
import { DuelResult } from "./DuelResult";
import { DuelStage } from "./DuelStage";

const HEARTBEAT_FROM_SEC = 10;

export function DuelMatch({
  flow,
  rating,
  onRematch,
  onDone,
}: {
  flow: DuelFlow;
  rating: string;
  onRematch: (tier: number) => void;
  onDone: () => void;
}) {
  const now = useServerSeconds();
  const m = flow.match;
  const quotes = useDuelCardQuotes(m);
  const them = m ? opponentOf(m, flow.owner) : null;
  const profile = useProfile(them ?? undefined);
  if (!m || !them) return null;
  const seat = seatOf(m, flow.owner);
  if (seat === null) return null;
  const other = seat === 0 ? 1 : 0;
  const p = "value" in profile ? profile.value : undefined;
  const themName = p?.handle ? `@${p.handle}` : shortAddress(them);
  const picking = m.state === "picking";
  const left = m.pickDeadline === null ? 0 : Math.max(0, m.pickDeadline - now);
  const theirCount = m.picks.filter((x) => x.seat === other).length;
  const over = m.state === "finalized" || m.state === "refunded" || m.state === "failed";
  return (
    <div className="flex flex-col gap-4">
      <DuelStage
        me={flow.owner}
        rating={rating}
        opponent={{ kind: "person", address: them }}
        opponentName={themName}
        pot={potLine(m)}
        totals={[seatTotal(m, seat), seatTotal(m, other)]}
        beating={picking && left > 0 && left <= HEARTBEAT_FROM_SEC}
        matchKey={m.matchId}
      >
        {m.state === "opening" || m.state === "sealed" ? (
          <p role="status" className="text-center text-meta opacity-80">
            Matched · sealing the deck so neither of you sees it first…
          </p>
        ) : null}
        {picking ? (
          <ProgressBar
            label={`Picks close · ${themName} has ${theirCount} of ${DUEL.cards}`}
            value={left}
            max={DUEL.pickWindowSec}
            valueText={`${clockText(left)} left`}
            tone={clockTone(left)}
          />
        ) : null}
        {over ? <DuelResult m={m} me={flow.owner} onRematch={() => onRematch(m.tier)} onDone={onDone} /> : null}
      </DuelStage>
      {m.cards.length > 0 ? <DuelLanes m={m} seat={seat} quotes={quotes} flow={flow} opponentName={themName} /> : null}
      <p className="text-micro text-text-3">
        Deck sealed {shortAddress(m.deckHash)}
        {m.serverSeed ? ` · seed ${shortAddress(m.serverSeed)}` : ""}
      </p>
    </div>
  );
}
