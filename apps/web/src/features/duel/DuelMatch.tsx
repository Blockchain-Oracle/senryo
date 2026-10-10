"use client";
/**
 * A dealt duel (S8.6; Owarine's Lobby, Picking, Waiting and Result in one place): you versus them with each total,
 * the pick clock (21st Progress Bar #23549), your undecided cards as a swipe deck (21st Swipe Deck #23568: ← Down,
 * Up →), then every card as a row — your call and theirs (theirs once you've called that card or the picks closed)
 * and what each returned — and the outcome. The sealed deck's commitment and the revealed seed sit at the foot.
 */
import {
  cardLine,
  cardResultText,
  clockTone,
  DUEL_SIDES,
  multiplierText,
  opponentOf,
  outcomeText,
  pickOn,
  seatOf,
  sideLabel,
  tierTitle,
} from "@senryo/calls";
import { type DuelCardQuote, type DuelFlow, useDuelCardQuotes } from "@senryo/calls/react";
import { DUEL, duelTierOf } from "@senryo/config";
import { clockText, shortAddress, signedUsd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { useProfile } from "@senryo/query";
import { Avatar } from "@/components/identity/avatar";
import { EntityMark } from "@/components/identity/entity-mark";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SwipeDeck } from "@/components/ui/swipe-deck";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { cn } from "@/lib/utils";

const MARK = 28;
const FACE_MARK = 40;
const [DOWN, UP] = [DUEL_SIDES[1], DUEL_SIDES[0]];
const AVATAR = 40;

/** A seat's person: the handle (or the short address) and the chosen portrait (R2.8: people show as themselves). */
function usePerson(address: string | null): { name: string; avatar: string | null; address: string | undefined } {
  const profile = useProfile(address ?? undefined);
  if (!address) return { name: "—", avatar: null, address: undefined };
  const p = "value" in profile ? profile.value : undefined;
  return { name: p?.handle ? `@${p.handle}` : shortAddress(address), avatar: p?.avatar ?? null, address };
}

export function DuelMatch({ flow, onAgain }: { flow: DuelFlow; onAgain: () => void }) {
  const m = flow.match;
  const now = useServerSeconds();
  const quotes = useDuelCardQuotes(m);
  const opponent = usePerson(m ? opponentOf(m, flow.owner) : null);
  const me = usePerson(flow.owner ?? null);
  const them = opponent.name;
  if (!m) return null;
  const seat = seatOf(m, flow.owner);
  if (seat === null) return null;
  const other = seat === 0 ? 1 : 0;
  const tier = duelTierOf(ACTIVE_NETWORK.chainId, m.tier);
  const results = m.results;
  const picking = m.state === "picking";
  const left = m.pickDeadline === null ? 0 : Math.max(0, m.pickDeadline - now);
  const undecided = quotes.filter((q) => !pickOn(m, seat, q.index) && !flow.placing.has(q.index));
  const theirCount = m.picks.filter((p) => p.seat === other).length;
  const outcome = outcomeText(m, flow.owner);
  const over = m.state === "finalized" || m.state === "refunded" || m.state === "failed";
  return (
    <section aria-label="Your duel" className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side name="You" person={me} total={results?.[seat] ?? null} align="start" />
        <span className="flex flex-col items-center text-meta text-text-3">
          vs
          {tier ? <span className="tnum">{tierTitle(tier)}</span> : null}
        </span>
        <Side name={them} person={opponent} total={results?.[other] ?? null} align="end" />
      </div>

      {m.state === "opening" || m.state === "sealed" ? (
        <p className="text-body text-text-2" role="status" aria-live="polite">
          Matched with {them} · sealing the deck…
        </p>
      ) : null}

      {picking ? (
        <div className="flex flex-col gap-4">
          <ProgressBar
            label={`Picks close · ${them} has ${theirCount} of ${DUEL.cards}`}
            value={left}
            max={DUEL.pickWindowSec}
            valueText={`${clockText(left)} left`}
            tone={clockTone(left)}
          />
          <SwipeDeck
            items={undecided}
            index={0}
            itemKey={(q) => q.card.windowId}
            itemLabel={(q) => cardLine(q.card)}
            onDecide={(q, side) => void flow.pick(q, side === "right" ? UP : DOWN)}
            leftLabel={DOWN.label}
            rightLabel={UP.label}
            emptyLabel={flow.placing.size > 0 ? "Placing your calls…" : `Waiting for ${them}`}
          >
            {(q) => <CardFace q={q} stake={m.cardStake} />}
          </SwipeDeck>
        </div>
      ) : null}

      {m.cards.length > 0 ? (
        <ul aria-label="Cards" className="flex flex-col divide-y divide-border">
          {m.cards.map((c, i) => {
            const mine = pickOn(m, seat, i);
            const theirs = pickOn(m, other, i);
            const shown = !picking || mine !== null;
            const q = quotes[i];
            return (
              <li key={c.windowId} className="flex items-center gap-3 py-3">
                <EntityMark id={marketId(c.symbol)} size={MARK} decorative />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-row-title">{cardLine(c)}</span>
                  <span className="tnum text-meta text-text-3">
                    {q && q.closesIn > 0 ? `Closes in ${clockText(q.closesIn)}` : "Closed"}
                  </span>
                </span>
                <Call label="You" pick={mine} stake={m.cardStake} pending={flow.placing.has(i)} />
                <Call
                  label={them}
                  pick={shown ? theirs : null}
                  stake={m.cardStake}
                  hidden={!shown && theirs !== null}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {over || m.state === "settling" || m.state === "forfeited" ? (
        <div className="flex flex-col gap-1" role="status" aria-live="polite">
          <span className="font-semibold text-section-title">{outcome.title}</span>
          <span className="tnum text-meta text-text-2">{outcome.detail}</span>
        </div>
      ) : null}

      <p className="break-all text-micro text-text-3">
        Deck sealed {shortAddress(m.deckHash)}
        {m.serverSeed ? ` · seed ${shortAddress(m.serverSeed)}` : ""}
      </p>

      {over ? (
        <button
          type="button"
          onClick={onAgain}
          className="h-14 rounded-xl bg-primary font-semibold text-button text-primary-foreground transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Duel again
        </button>
      ) : null}
    </section>
  );
}

function Side({
  name,
  person,
  total,
  align,
}: {
  name: string;
  person: { avatar: string | null; address: string | undefined };
  total: bigint | null;
  align: "start" | "end";
}) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-1", align === "end" ? "items-end" : "items-start")}>
      <Avatar avatar={person.avatar} {...(person.address ? { address: person.address } : {})} size={AVATAR} />
      <span className="truncate text-meta text-text-2">{name}</span>
      <span
        className={cn(
          "tnum font-semibold text-num-md",
          total === null ? "text-text-3" : total > 0n ? "text-up" : total < 0n ? "text-down" : "text-foreground",
        )}
      >
        {total === null ? "—" : signedUsd(total)}
      </span>
    </span>
  );
}

function Call(p: {
  label: string;
  pick: { band: number; returned: bigint | null; result: bigint | null } | null;
  stake: bigint;
  pending?: boolean;
  hidden?: boolean;
}) {
  const word = p.pending ? "Placing" : p.hidden ? "Called" : p.pick ? sideLabel(p.pick.band) : "—";
  const tone = p.pick && !p.hidden ? (p.pick.band === UP.band ? "text-up" : "text-down") : "text-text-3";
  return (
    <span className="flex w-24 flex-col items-end">
      <span className="truncate text-micro text-text-3">{p.label}</span>
      <span className={cn("font-semibold text-meta", tone)}>{word}</span>
      {p.pick && p.pick.returned !== null ? (
        <span className="tnum text-micro text-text-2">{cardResultText(p.pick, p.stake)}</span>
      ) : null}
    </span>
  );
}

function CardFace({ q, stake }: { q: DuelCardQuote; stake: bigint }) {
  const [up, down] = q.sides;
  return (
    <div className="flex h-full flex-col justify-between p-5">
      <div className="flex items-center gap-3">
        <EntityMark id={marketId(q.card.symbol)} size={FACE_MARK} decorative />
        <span className="flex flex-col">
          <span className="font-semibold text-title">{cardLine(q.card)}</span>
          <span className="tnum text-meta text-text-3">Closes in {clockText(q.closesIn)}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <span className="flex flex-col">
          <span className="text-meta text-down">← {down?.label}</span>
          <span className="tnum font-semibold text-row-title">
            {down?.payout ? multiplierText(stake, down.payout) : "—"}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-meta text-up">{up?.label} →</span>
          <span className="tnum font-semibold text-row-title">
            {up?.payout ? multiplierText(stake, up.payout) : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
