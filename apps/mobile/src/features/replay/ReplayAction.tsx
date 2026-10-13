/**
 * The receipt's way into its replay (Q3, D-352, D-353; Codex direction 18 §A): the row's first circle, "Replay" on the
 * brand colour. Tapping it fetches the trade's 1-minute candles (the circle spins), fills whatever this phone didn't
 * record — or rebuilds a trade it never saw — builds the film once and opens the Replay sheet. If the candles can't be
 * had, what was recorded still plays.
 */
import type { Episode, FilmCandle, ReceiptFilm } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { useCandleRange } from "@senryo/query";
import { useEffect, useState } from "react";
import { ActionCircle } from "~/components/kit/ActionCircle";
import { PlayFill } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { notify } from "~/lib/notify";
import { ReplaySheet } from "./ReplaySheet";

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
        icon={PlayFill}
        label="Replay"
        primary
        busy={wanted}
        onPress={() => {
          fire("tick");
          setWanted(true);
        }}
      />
      {film ? <ReplaySheet film={film} url={url} onClose={() => setFilm(null)} /> : null}
    </>
  );
}
