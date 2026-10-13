/**
 * The receipt's way into its replay (Q3, D-352; Codex direction 18 §A): the row's first circle, "Replay" on the brand
 * colour. Tapping it builds the film from the receipt's records once and opens the Replay sheet. When this phone
 * didn't record the trade the circle stays in its place, inert, and says so.
 */
import type { Episode, ReceiptFilm } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { useState } from "react";
import { ActionCircle } from "~/components/kit/ActionCircle";
import { PlayFill } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { notify } from "~/lib/notify";
import { ReplaySheet } from "./ReplaySheet";

export function ReplayAction({
  chainId,
  bookKey,
  url,
  build,
}: {
  chainId: number;
  bookKey: string;
  url: string;
  build: (episode: Episode) => ReceiptFilm | null;
}) {
  const episode = useEpisode(chainId, bookKey);
  const [film, setFilm] = useState<ReceiptFilm | null>(null);
  const recorded = episode !== null && episode !== undefined && episode.samples.length >= 2;
  return (
    <>
      <ActionCircle
        icon={PlayFill}
        label="Replay"
        primary
        reason={recorded ? undefined : "Not recorded"}
        onPress={() => {
          const built = episode ? build(episode) : null;
          if (!built) return notify({ title: "Replay unavailable" });
          fire("tick", { cue: "sheetOpen" });
          setFilm(built);
        }}
      />
      {film ? <ReplaySheet film={film} url={url} onClose={() => setFilm(null)} /> : null}
    </>
  );
}
