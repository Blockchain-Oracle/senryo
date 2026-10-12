"use client";
/**
 * Warm-up's pieces (R7.5): the big live card (mark, market, the window, the rolling price, its 24 h line and change),
 * the five slots of you against the coin (your pick, then the coin's flipping in), and a race row for the watch — the
 * live move since your pick and who leads it — which the reveal stamps Right, Wrong or Flat.
 */
import { useDayLine } from "@senryo/calls/react";
import { lane, type WarmUpCard, type WarmUpResult, type WarmUpSide, warmUpLeader } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/web";
import { useSampledPrice } from "@senryo/live/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ChangeChip } from "@/components/ui/change-chip";
import { Sparkline } from "@/components/ui/sparkline";
import { PIXEL_COLORS } from "@/lib/pixel-colors";
import { cn } from "@/lib/utils";

const CARD_MARK = 64;
const SLOT_MARK = 20;
const ROW_MARK = 28;
const COIN = 20;
const PRICE_MS = 250;
const E8 = 1e8;
const BP = 10_000;
const PRICE_DIGITS = 2;
const BP_DIGITS = 1;

export const priceText = (e8: number | null | undefined) =>
  e8 === null || e8 === undefined ? "—" : (e8 / E8).toLocaleString(undefined, { maximumFractionDigits: PRICE_DIGITS });

/** One pick as an arrow on its direction fill. */
export function SideChip({ side, className }: { side: WarmUpSide; className?: string }) {
  const Arrow = side === "up" ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg text-on-direction-fill",
        side === "up" ? "bg-up-fill" : "bg-down-fill",
        className,
      )}
      title={side === "up" ? "Up" : "Down"}
    >
      <Arrow aria-hidden className="size-4" strokeWidth={3} />
    </span>
  );
}

export function WarmCard({ card, of }: { card: WarmUpCard; of: number }) {
  const price = useSampledPrice(card.symbol, PRICE_MS);
  const day = useDayLine(card.symbol);
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-7">
      <span className="text-meta text-text-3">
        Card {card.index + 1} of {of} · {lane(card.cadenceSec)}
      </span>
      <EntityMark id={marketId(card.symbol)} size={CARD_MARK} decorative />
      <span className="font-semibold text-page-title">{card.symbol}</span>
      <span className="tnum font-semibold text-section-title">{priceText(price)}</span>
      {day ? (
        <span className="flex w-full max-w-60 items-center gap-3">
          <Sparkline symbol={card.symbol} day={day} className="h-10 flex-1" />
          <ChangeChip symbol={card.symbol} day={day} />
        </span>
      ) : null}
      <span className="text-meta text-text-3">Up or down 30 seconds after your last card?</span>
    </div>
  );
}

/** The five slots: your pick on each card, the coin's flipping in beside it once you've picked. */
export function Slots({
  cards,
  picks,
  coinOf,
  results,
}: {
  cards: readonly WarmUpCard[];
  picks: readonly { cardIndex: number; side: WarmUpSide }[];
  coinOf: (index: number) => WarmUpSide;
  results: readonly (WarmUpResult | null)[];
}) {
  return (
    <ol aria-label="You against the coin" className="grid grid-cols-5 gap-2">
      {cards.map((c) => {
        const pick = picks.find((p) => p.cardIndex === c.index);
        const result = results[c.index] ?? null;
        return (
          <li
            key={c.index}
            className={cn(
              "warm-slot flex flex-col items-center gap-1 rounded-xl bg-card py-2",
              result === "won" && "is-won",
              result === "lost" && "is-lost",
            )}
          >
            <EntityMark id={marketId(c.symbol)} size={SLOT_MARK} decorative />
            {pick ? (
              <SideChip side={pick.side} className="size-6" />
            ) : (
              <span className="size-6 rounded-lg bg-secondary" />
            )}
            {pick ? (
              <span key={`coin-${c.index}`} className="warm-coin">
                <SideChip side={coinOf(c.index)} className="size-6 opacity-80" />
              </span>
            ) : (
              <PixelMark name="coin" size={COIN} colors={PIXEL_COLORS} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const LEAD_WORD = { you: "You lead", coin: "Coin leads", even: "Even" } as const;
const RESULT_WORD: Record<WarmUpResult, string> = { won: "RIGHT", lost: "WRONG", flat: "FLAT" };

/** A card's race: your pick against the coin's on the live move since your pick; stamped once it's scored. */
export function RaceRow({
  card,
  side,
  coin,
  entryE8,
  closeE8,
  result,
}: {
  card: WarmUpCard;
  side: WarmUpSide;
  coin: WarmUpSide;
  entryE8: number;
  /** The scored close once revealed; until then the row follows the live price. */
  closeE8: number | null;
  result: WarmUpResult | null;
}) {
  const live = useSampledPrice(card.symbol, PRICE_MS);
  const now = closeE8 ?? live ?? entryE8;
  const moveBp = entryE8 === 0 ? 0 : ((now - entryE8) / entryE8) * BP;
  const lead = warmUpLeader(side, coin, entryE8, now);
  return (
    <li className="flex items-center gap-3 py-3">
      <EntityMark id={marketId(card.symbol)} size={ROW_MARK} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row-title">{card.symbol}</span>
        <span className={cn("tnum text-meta", moveBp > 0 ? "text-up" : moveBp < 0 ? "text-down" : "text-text-3")}>
          {moveBp > 0 ? "+" : ""}
          {moveBp.toFixed(BP_DIGITS)} bp · {priceText(now)}
        </span>
      </span>
      <span className="flex items-center gap-1 text-meta text-text-3">
        you <SideChip side={side} className="size-6" /> coin <SideChip side={coin} className="size-6 opacity-80" />
      </span>
      {result ? (
        <span
          className={cn(
            "warm-stamp w-16 text-center font-semibold text-row-title",
            result === "won" ? "text-up" : result === "lost" ? "text-down" : "text-text-3",
          )}
        >
          {RESULT_WORD[result]}
        </span>
      ) : (
        <span
          className={cn(
            "w-16 text-center text-meta",
            lead === "you" ? "text-up" : lead === "coin" ? "text-down" : "text-text-3",
          )}
        >
          {LEAD_WORD[lead]}
        </span>
      )}
    </li>
  );
}
