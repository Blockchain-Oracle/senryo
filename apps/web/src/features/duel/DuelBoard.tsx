"use client";
/**
 * Beside the arena (P4; the phone's `DuelBoard`): the rank ladder — the top players by rating with their records,
 * your row pinned when you're outside them — and your finished duels with the opponent's portrait, the verdict and
 * both totals. An empty history is one line inviting a first duel.
 */
import type { DuelRatingView, DuelView } from "@senryo/api-client";
import { DUEL_LIVE_STATES, opponentOf, outcomeText } from "@senryo/calls";
import { shortAddress } from "@senryo/core";
import { useDuelLadder, useProfile } from "@senryo/query";
import { Avatar } from "@/components/identity/avatar";
import { cn } from "@/lib/utils";

const LADDER_ROWS = 10;
const FACE = 32;

const record = (r: { wins: number; losses: number; ties: number }) =>
  `${r.wins}–${r.losses}${r.ties ? `–${r.ties}` : ""}`;

export function DuelLadder({ me, rating }: { me: string | undefined; rating: DuelRatingView | null }) {
  const ladder = useDuelLadder();
  const players = "value" in ladder ? ladder.value.players : [];
  const top = players.slice(0, LADDER_ROWS);
  const mine = me?.toLowerCase();
  const myRank = players.findIndex((p) => p.owner.toLowerCase() === mine);
  const pinned = rating && rating.played > 0 && (myRank < 0 || myRank >= LADDER_ROWS);
  if (top.length === 0) return null;
  return (
    <section aria-label="Duel ladder" className="flex flex-col gap-1">
      <h2 className="pb-1 font-semibold text-section-title">Ladder</h2>
      <ol className="flex flex-col">
        {top.map((p, i) => (
          <Row
            key={p.owner}
            rank={i + 1}
            name={p.handle ? `@${p.handle}` : shortAddress(p.owner)}
            rating={p.rating}
            record={record(p)}
            you={p.owner.toLowerCase() === mine}
          />
        ))}
        {pinned && rating ? (
          <Row rank={myRank >= 0 ? myRank + 1 : null} name="You" rating={rating.rating} record={record(rating)} you />
        ) : null}
      </ol>
    </section>
  );
}

function Row(p: { rank: number | null; name: string; rating: number; record: string; you: boolean }) {
  return (
    <li className={cn("flex min-h-11 items-center gap-3 rounded-lg px-2", p.you && "bg-selected-row")}>
      <span className="tnum w-6 text-center text-meta text-text-3">{p.rank ?? "—"}</span>
      <span className="flex-1 truncate font-semibold text-row-title">{p.name}</span>
      <span className="tnum text-meta text-text-3">{p.record}</span>
      <span className="tnum font-semibold text-row-title">{p.rating}</span>
    </li>
  );
}

export function DuelHistory({ me, duels }: { me: string | undefined; duels: readonly DuelView[] }) {
  const done = duels.filter((d) => !DUEL_LIVE_STATES.has(d.state));
  return (
    <section aria-label="Your duels" className="flex flex-col gap-1">
      <h2 className="pb-1 font-semibold text-section-title">Your duels</h2>
      {done.length === 0 ? (
        <p className="text-body text-text-2">Your first duel lands here — pick a tier.</p>
      ) : (
        <ul className="flex flex-col">
          {done.map((d) => (
            <HistoryRow key={d.matchId} d={d} me={me} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ d, me }: { d: DuelView; me: string | undefined }) {
  const them = opponentOf(d, me);
  const profile = useProfile(them ?? undefined);
  const p = them && "value" in profile ? profile.value : undefined;
  const o = outcomeText(d, me);
  const won = d.winner !== null && d.winner.toLowerCase() === me?.toLowerCase();
  return (
    <li className="flex min-h-14 items-center gap-3">
      <Avatar avatar={p?.avatar ?? null} {...(them ? { address: them } : {})} size={FACE} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("font-semibold text-row-title", won && "text-up")}>{o.title}</span>
        <span className="truncate text-meta text-text-3">
          vs {p?.handle ? `@${p.handle}` : them ? shortAddress(them) : "—"}
          {o.detail ? ` · ${o.detail}` : ""}
        </span>
      </span>
    </li>
  );
}
