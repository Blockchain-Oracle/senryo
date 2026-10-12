"use client";
/**
 * The verdict on the stage (P4; the phone's `DuelResult`): who won and by what, the pot, and why a tie, refund or
 * forfeit went as it did; then Rematch at the same tier and Share (the system share, or the link copied).
 */
import type { DuelView } from "@senryo/api-client";
import { outcomeText, seatOf } from "@senryo/calls";
import { signedUsd, usd } from "@senryo/core";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SHARE_PATH = "/app/duel/";

export function DuelResult({
  m,
  me,
  onRematch,
  onDone,
}: {
  m: DuelView;
  me: string | undefined;
  onRematch: () => void;
  onDone: () => void;
}) {
  const o = outcomeText(m, me);
  const seat = seatOf(m, me);
  const won = m.winner !== null && m.winner.toLowerCase() === me?.toLowerCase();
  const mine = m.results && seat !== null ? m.results[seat] : null;
  const pot =
    m.pot === 0n
      ? "No pot"
      : !m.winner
        ? "Pot returned to both"
        : won
          ? `+${usd(m.pot * 2n)} pot`
          : "The pot went to them";
  const share = async () => {
    fire("tick", { cue: "tap" });
    const url = `${window.location.origin}${SHARE_PATH}`;
    const text = `${won ? `I won a duel on Senryo${mine !== null ? ` (${signedUsd(mine)})` : ""}.` : "A duel on Senryo."} Three calls each, the better total takes the pot.`;
    if (navigator.share) {
      await navigator.share({ text, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${text} ${url}`);
    notify({ title: "Link copied", description: "Paste it anywhere." });
  };
  return (
    <div aria-live="polite" className="flex flex-col items-center gap-2 pt-2 text-center">
      <h2 className={cn("font-display text-page-title", won && "text-up")}>{o.title}</h2>
      <p className="text-meta opacity-80">{o.detail ? `${o.detail} · ${pot}` : pot}</p>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            onDone();
            onRematch();
          }}
          className="h-12 rounded-full bg-primary font-semibold text-button text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Rematch
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="h-12 rounded-full bg-white/10 font-semibold text-button focus-visible:outline-2 focus-visible:outline-ring"
        >
          Share
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="h-11 px-4 font-semibold text-meta underline-offset-4 hover:underline"
      >
        Back to tiers
      </button>
    </div>
  );
}
