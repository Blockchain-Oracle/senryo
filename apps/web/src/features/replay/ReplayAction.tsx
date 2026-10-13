"use client";
/**
 * The receipt's way into its replay (Q3, D-352, D-353; Codex direction 18 §A; the phone's `ReplayAction`): the row's
 * first circle, "Replay" on the brand colour. Clicking it fetches the trade's 1-minute candles (the circle spins),
 * fills whatever this browser didn't record — or rebuilds a trade it never saw — builds the film once and opens the
 * Replay modal. If the candles can't be had, what was recorded still plays.
 */
import type { Episode, FilmCandle, ReceiptFilm } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { useCandleRange } from "@senryo/query";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionCircle } from "@/components/ui/action-circle";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { ReplayModal } from "./ReplayModal";

export function ReplayAction({
  chainId,
  bookKey,
  url,
  span,
  build,
}: {
  chainId: number;
  bookKey: string;
  url: string;
  /** The trade's market and its span (unix seconds, the lead-in included) for the candles. */
  span: { symbol: string; fromSec: number; toSec: number };
  build: (episode: Episode | null, candles: readonly FilmCandle[] | undefined) => ReceiptFilm | null;
}) {
  const episode = useEpisode(chainId, bookKey);
  const [wanted, setWanted] = useState(false);
  const [film, setFilm] = useState<ReceiptFilm | null>(null);
  const candles = useCandleRange(span.symbol, span.fromSec, span.toSec, wanted);
  const settled = "value" in candles || candles.status === "failed";
  useEffect(() => {
    if (!wanted || !settled) return;
    setWanted(false);
    const built = build(episode ?? null, "value" in candles ? candles.value.candles : undefined);
    if (!built) return void notify({ title: "Replay unavailable" });
    fire("tick", { cue: "sheetOpen" });
    setFilm(built);
  }, [wanted, settled, candles, episode, build]);
  return (
    <>
      <ActionCircle
        icon={<Play aria-hidden className="fill-current" />}
        label="Replay"
        primary
        busy={wanted}
        onClick={() => {
          fire("tick", { cue: "tap" });
          setWanted(true);
        }}
      />
      {film ? <ReplayModal film={film} url={url} open onOpenChange={(o) => !o && setFilm(null)} /> : null}
    </>
  );
}
