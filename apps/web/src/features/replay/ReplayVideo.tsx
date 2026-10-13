"use client";
/**
 * The receipt's way to its video (Q3, D-350; the phone's `ReplayVideo`): "Video" under the paper when this browser
 * recorded the trade — clicking it builds the film from the receipt's records once and opens the video — or "Replay
 * unavailable" when it didn't.
 */
import type { Episode, ReceiptFilm } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fire } from "@/lib/feedback";
import { VideoModal } from "./VideoModal";

export function ReplayVideo({
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
  if (!episode || episode.samples.length < 2) return <p className="text-meta text-text-3">Replay unavailable</p>;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          fire("tick", { cue: "sheetOpen" });
          setFilm(build(episode));
        }}
      >
        Video
      </Button>
      {film ? <VideoModal film={film} url={url} open onOpenChange={(o) => !o && setFilm(null)} /> : null}
    </>
  );
}
