"use client";
/**
 * The receipt's way into its replay (Q3, D-352; Codex direction 18 §A; the phone's `ReplayAction`): the row's first
 * circle, "Replay" on the brand colour. Clicking it builds the film from the receipt's records once and opens the
 * Replay modal. When this browser didn't record the trade the circle keeps its place, dimmed, and says so.
 */
import type { Episode, ReceiptFilm } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { Play } from "lucide-react";
import { useState } from "react";
import { ActionCircle } from "@/components/ui/action-circle";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { ReplayModal } from "./ReplayModal";

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
        icon={<Play aria-hidden className="fill-current" />}
        label="Replay"
        primary
        {...(recorded ? {} : { reason: "Not recorded" })}
        onClick={() => {
          const built = episode ? build(episode) : null;
          if (!built) return notify({ title: "Replay unavailable" });
          fire("tick", { cue: "sheetOpen" });
          setFilm(built);
        }}
      />
      {film ? <ReplayModal film={film} url={url} open onOpenChange={(o) => !o && setFilm(null)} /> : null}
    </>
  );
}
