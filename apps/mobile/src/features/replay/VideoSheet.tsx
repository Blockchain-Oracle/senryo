/**
 * The replay video (Q3, D-350; Codex direction 17 §4): the whole 4:5 card as you'll post it, Play / Pause and a scrub,
 * "Sound in video", and the file made as soon as the sheet opens — "Making video 62%" with Cancel — then Save video
 * (Photos, add-only, asked on that tap) and Share video. Hidden balances block it; an older binary without the encoder
 * says so, and the receipt's image actions stay.
 */
import type { ReceiptFilm } from "@senryo/calls";
import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Switch } from "~/components/kit/Switch";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { useOwnProfile } from "~/features/profile/useOwnProfile";
import { fire } from "~/feedback/fire";
import { useAppTrader } from "~/lib/account/guest";
import { useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import { SPACE, TYPE, useTheme } from "~/theme";
import type { FilmImages } from "./drawFilm";
import { canSaveVideo, exportFilm, saveVideo, shareVideo } from "./exportFilm";
import { FilmAssets } from "./FilmAssets";
import { FilmPreview } from "./FilmPreview";
import { FILM_COLOURS, useFilmFonts, useFilmScene } from "./useFilmScene";

const PERCENT = 100;
const ROW = 56;

type Making =
  | { kind: "idle" }
  | { kind: "making"; share: number }
  | { kind: "ready"; uri: string }
  | { kind: "failed" };

export function VideoSheet({ film, url, onClose }: { film: ReceiptFilm; url: string; onClose: () => void }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const { owner } = useAppTrader();
  const { profile } = useOwnProfile();
  const identity = profile.kind === "ready" ? profile.identity : null;
  const handle = identity?.handle ?? null;
  const fonts = useFilmFonts();
  const scene = useFilmScene(film, handle, hidden);
  const [images, setImages] = useState<FilmImages | null>(null);
  const [width, setWidth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [making, setMaking] = useState<Making>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  const encoder = canSaveVideo();

  // The file is made from a frozen snapshot as soon as everything is drawn; turning sound off or on makes it again.
  useEffect(() => {
    if (!encoder || hidden || !scene || !fonts || !images) return;
    const controller = new AbortController();
    abort.current = controller;
    setMaking({ kind: "making", share: 0 });
    exportFilm(
      { ...scene, colours: FILM_COLOURS, fonts, images, sound },
      (share) => setMaking((m) => (m.kind === "making" ? { kind: "making", share } : m)),
      controller.signal,
    )
      .then((uri) => {
        if (!controller.signal.aborted) setMaking({ kind: "ready", uri });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMaking({ kind: "failed" });
      });
    return () => controller.abort();
  }, [encoder, hidden, scene, fonts, images, sound]);

  const ready = making.kind === "ready" ? making.uri : null;
  return (
    <Sheet onClose={onClose} closeLabel="Close the video">
      <SheetHeading title="Replay video" />
      <FilmAssets
        symbol={film.input.symbol}
        avatar={identity?.avatar ?? null}
        address={owner}
        url={url}
        onReady={setImages}
      />
      <View style={styles.body} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {scene && fonts && images && width > 0 ? (
          <FilmPreview
            frames={scene.frames}
            totalMs={scene.totalMs}
            words={scene.words}
            colours={FILM_COLOURS}
            fonts={fonts}
            images={images}
            width={width}
            playing={playing}
            onEnd={() => setPlaying(false)}
          />
        ) : (
          <Text style={[TYPE.row, { color: color.inkMuted }]}>{scene ? "Drawing…" : "Replay unavailable"}</Text>
        )}
        <Button
          label={playing ? "Pause" : "Play"}
          variant="secondary"
          onPress={() => {
            fire("tick");
            setPlaying((p) => !p);
          }}
          disabled={!scene}
        />
        <View style={styles.row}>
          <Text style={[TYPE.row, styles.grow, { color: color.ink }]}>Sound in video</Text>
          <Switch value={sound} onValueChange={setSound} accessibilityLabel="Sound in video" />
        </View>
        {hidden ? (
          <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>Show balances to share or save this video.</Text>
        ) : !encoder ? (
          <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>Video unavailable here — update the app.</Text>
        ) : making.kind === "making" ? (
          <View style={styles.row}>
            <Text style={[TYPE.row, styles.grow, { color: color.ink }]}>
              Making video {Math.round(making.share * PERCENT)}%
            </Text>
            <Button label="Cancel" variant="secondary" size="sm" block={false} onPress={() => abort.current?.abort()} />
          </View>
        ) : making.kind === "failed" ? (
          <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>The video couldn't be made. Try again.</Text>
        ) : null}
        <Button
          label="Save video"
          disabled={!ready}
          onPress={() => {
            if (!ready) return;
            fire("press");
            void saveVideo(ready).then((saved) =>
              notify(
                saved
                  ? { title: "Saved to Photos" }
                  : { title: "Photos access is off", description: "Share video still works.", tone: "warning" },
              ),
            );
          }}
        />
        <Button
          label="Share video"
          variant="secondary"
          disabled={!ready}
          onPress={() => {
            if (!ready) return;
            fire("press");
            void shareVideo(ready);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md, paddingBottom: SPACE.lg },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: ROW },
  grow: { flex: 1 },
});
