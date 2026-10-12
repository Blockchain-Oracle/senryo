"use client";
/**
 * The dealt deck as three shared market lanes (P4, D-322; the phone's `DuelLanes`): both seats call the same three
 * windows. Each lane shows the mark, the window, the live price with its 24 h line, the clock and both sides with what
 * the card's stake pays. Your call locks into your side; the opponent's only says they've called until it may show
 * (you've called that card, or picks closed). Settled cards show each side's result.
 */
import type { DuelView } from "@senryo/api-client";
import { cardLine, cardResultText, DUEL_SIDES, pickOn, sideLabel, unitOf } from "@senryo/calls";
import { type DuelCardQuote, type DuelFlow, useDayLine } from "@senryo/calls/react";
import { clockText, formatPrice, priceFromE8 } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

const MARK = 32;
const E2 = 100;
const MULTIPLE_DECIMALS = 2;

type Pick = { band: number; returned: bigint | null; result: bigint | null } | null;

export function DuelLanes({
  m,
  seat,
  quotes,
  flow,
  opponentName,
}: {
  m: DuelView;
  seat: 0 | 1;
  quotes: readonly DuelCardQuote[];
  flow: DuelFlow;
  opponentName: string;
}) {
  const other = seat === 0 ? 1 : 0;
  const picking = m.state === "picking";
  return (
    <ol aria-label="The three cards" className="flex flex-col gap-2">
      {quotes.map((q) => {
        const own = pickOn(m, seat, q.index);
        return (
          <Lane
            key={q.card.windowId}
            q={q}
            stake={m.cardStake}
            own={own}
            their={pickOn(m, other, q.index)}
            showTheirs={!picking || own !== null}
            canPick={picking && own === null && !flow.placing.has(q.index)}
            placing={flow.placing.has(q.index)}
            opponentName={opponentName}
            onPick={(band) => {
              const side = DUEL_SIDES.find((s) => s.band === band);
              if (side) void flow.pick(q, side);
            }}
          />
        );
      })}
    </ol>
  );
}

const resultOf = (pick: NonNullable<Pick>, stake: bigint) =>
  pick.returned === null ? "" : ` · ${cardResultText(pick, stake)}`;

function Lane(p: {
  q: DuelCardQuote;
  stake: bigint;
  own: Pick;
  their: Pick;
  showTheirs: boolean;
  canPick: boolean;
  placing: boolean;
  opponentName: string;
  onPick: (band: number) => void;
}) {
  const { q } = p;
  const priceE8 = useLivePrice(q.card.symbol);
  const day = useDayLine(q.card.symbol);
  const price = formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8), undefined, unitOf(q.card.symbol));
  const theirWord =
    p.their === null
      ? "Deciding…"
      : p.showTheirs
        ? `${sideLabel(p.their.band)}${resultOf(p.their, p.stake)}`
        : "Called";
  const ownWord = p.placing ? "Placing…" : p.own ? `${sideLabel(p.own.band)}${resultOf(p.own, p.stake)}` : "Your call";
  return (
    <li className="@container flex flex-col gap-3 rounded-2xl bg-secondary p-4">
      <div className="flex items-center gap-3">
        <EntityMark id={marketId(q.card.symbol)} size={MARK} decorative />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-row-title">{cardLine(q.card)}</span>
          <span className="tnum text-meta text-text-3">
            {q.closesIn > 0 ? `Closes in ${clockText(q.closesIn)}` : "Closed · settling"}
          </span>
        </span>
        {day ? <Sparkline symbol={q.card.symbol} day={day} className="shrink-0 @max-xs:hidden" /> : null}
        <span className="tnum font-semibold text-row-price">{price}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {q.sides.map((s) => {
          const on = p.own?.band === s.band;
          const up = s.band === 0;
          const Arrow = up ? ArrowUp : ArrowDown;
          const multiple = s.multipleE2 === null ? "—" : `${(Number(s.multipleE2) / E2).toFixed(MULTIPLE_DECIMALS)}×`;
          const enabled = p.canPick && s.multipleE2 !== null;
          return (
            <button
              key={s.band}
              type="button"
              aria-pressed={on}
              disabled={!enabled}
              aria-label={`Call ${q.card.symbol} ${s.label}, pays ${multiple}`}
              onClick={() => p.onPick(s.band)}
              className={cn(
                "press-lift flex h-11 items-center justify-center gap-1.5 rounded-full font-semibold text-button-compact focus-visible:outline-2 focus-visible:outline-ring",
                on
                  ? up
                    ? "bg-up text-up-foreground"
                    : "bg-down text-down-foreground"
                  : "bg-(--shell-plate) hover:bg-accent disabled:opacity-40",
              )}
            >
              <Arrow aria-hidden strokeWidth={2.5} className={cn("size-4", !on && (up ? "text-up" : "text-down"))} />
              <span className="tnum">
                {s.label} · {multiple}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between gap-3 text-meta">
        <span className={p.own ? "" : "text-text-3"}>You · {ownWord}</span>
        <span className="truncate text-right text-text-3">
          {p.opponentName} · {theirWord}
        </span>
      </div>
    </li>
  );
}
