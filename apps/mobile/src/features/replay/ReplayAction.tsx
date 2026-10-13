/**
 * The receipt's way to its video (Q3, D-350): "Video" under the paper when this phone recorded the trade — tapping it
 * builds the film from the receipt's records once and opens the video sheet — or "Replay unavailable" when it didn't.
 */
import type { Episode, ReceiptFilm } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { useState } from "react";
import { Text } from "react-native";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { TYPE, useTheme } from "~/theme";
import { VideoSheet } from "./VideoSheet";

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
  const { color } = useTheme();
  const episode = useEpisode(chainId, bookKey);
  const [film, setFilm] = useState<ReceiptFilm | null>(null);
  if (!episode || episode.samples.length < 2) {
    return <Text style={[TYPE.rowDetail, { color: color.inkMuted, textAlign: "center" }]}>Replay unavailable</Text>;
  }
  return (
    <>
      <Button
        label="Video"
        variant="secondary"
        onPress={() => {
          fire("tick", { cue: "sheetOpen" });
          setFilm(build(episode));
        }}
      />
      {film ? <VideoSheet film={film} url={url} onClose={() => setFilm(null)} /> : null}
    </>
  );
}
