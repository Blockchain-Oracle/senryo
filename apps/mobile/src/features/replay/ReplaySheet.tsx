/**
 * The replay on the phone (Q3, D-350, D-352; Codex direction 18 §B): the whole 4:5 film as you'll post it, sized so
 * the band, its QR and the actions always show; one transport row (Play / Pause, the scrubber, "0:04 / 0:14", the
 * preview's sound on or off); one status line; Share and Save as action circles. It opens paused on the last frame
 * (the poster). The file is made, always with its sound, as soon as everything is drawn (waiting while the preview
 * plays, so the picture never stutters); once it exists, Play plays its own soundtrack in
 * step with the picture, so what you hear is what you post. Hidden balances cancel the file and silence it; an older
 * binary without the encoder plays the film but can't save it.
 */
import type { ReceiptFilm } from "@senryo/calls";
import { type AudioPlayer, createAudioPlayer } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionCircle, ActionCircles } from "~/components/kit/ActionCircle";
import { Download, Pause, PlayFill, Share, Volume, VolumeX } from "~/components/kit/symbols";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { useOwnProfile } from "~/features/profile/useOwnProfile";
import { fire } from "~/feedback/fire";
import { replayAudio } from "~/feedback/sound";
import { useAppTrader } from "~/lib/account/guest";
import { useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import { saveToPhotos } from "~/lib/photos";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { FilmImages } from "./drawFilm";
import { canSaveVideo, exportFilm, shareVideo } from "./exportFilm";
import { FilmAssets } from "./FilmAssets";
import { FilmPreview } from "./FilmPreview";
import { Scrubber } from "./Scrubber";
import { FILM_COLOURS, useFilmFonts, useFilmScene } from "./useFilmScene";

const PERCENT = 100;
const MS = 1_000;
const SECONDS = 60;
const DETENT = 0.9;
/** Everything that isn't the preview, measured on the sheet: heading, transport, status, actions and gaps (the bottom
 * inset is added). */
const CHROME = 306;
const ASPECT = 1.25;
const TRANSPORT = 48;
const ROW = 44;
const STATUS = 32;
const RAIL = 2;

type Making =
  | { kind: "preparing" }
  | { kind: "making"; share: number }
  | { kind: "ready"; uri: string }
  | { kind: "failed" }
  | { kind: "cancelled" };

const clock = (ms: number) => {
  const s = Math.round(ms / MS);
  return `${Math.floor(s / SECONDS)}:${String(s % SECONDS).padStart(2, "0")}`;
};

/** How long Play waits for the soundtrack to load before starting the picture anyway. */
const LOAD_WAIT_MS = 2_000;

/** Resolves once the player has loaded its file (or after `LOAD_WAIT_MS`: the picture never waits on sound forever). */
function whenLoaded(p: AudioPlayer): Promise<void> {
  if (p.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, LOAD_WAIT_MS);
    const sub = p.addListener("playbackStatusUpdate", (s) => {
      if (s.isLoaded) done();
    });
    function done() {
      clearTimeout(timer);
      sub.remove();
      resolve();
    }
  });
}

export function ReplaySheet({ film, url, onClose }: { film: ReceiptFilm; url: string; onClose: () => void }) {
  const { color } = useTheme();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [hidden, setHidden] = useHideBalances();
  const { owner } = useAppTrader();
  const { profile } = useOwnProfile();
  const identity = profile.kind === "ready" ? profile.identity : null;
  const fonts = useFilmFonts();
  const scene = useFilmScene(film, identity?.handle ?? null, hidden);
  const totalMs = scene?.totalMs ?? 0;
  const [images, setImages] = useState<FilmImages | null>(null);
  const [playing, setPlaying] = useState(false);
  const [second, setSecond] = useState(0);
  const [sound, setSound] = useState(true);
  const [making, setMaking] = useState<Making>({ kind: "preparing" });
  const [run, setRun] = useState(0);
  const why = useRef<"cancel" | null>(null);
  const abort = useRef<AbortController | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const t = useSharedValue(totalMs);
  const encoder = canSaveVideo();

  const sheetH = (window.height - insets.top) * DETENT;
  const previewH = Math.max(0, Math.min((window.width - SIZE.gutter * 2) * ASPECT, sheetH - CHROME - insets.bottom));
  const previewW = previewH / ASPECT;

  useEffect(() => {
    t.value = totalMs;
  }, [totalMs, t]);
  useAnimatedReaction(
    () => Math.floor(t.value / MS),
    (s, was) => {
      if (s !== was) runOnJS(setSecond)(s);
    },
  );

  // The file: made from a frozen snapshot once everything is drawn, always with its sound; Retry and Make replay make
  // it again. Play waits for it (`waiting`), so the preview never plays during the making.
  useEffect(() => {
    if (!encoder || hidden || !scene || !fonts || !images) return;
    void run;
    const controller = new AbortController();
    abort.current = controller;
    why.current = null;
    setMaking({ kind: "making", share: 0 });
    exportFilm(
      { ...scene, colours: FILM_COLOURS, fonts, images },
      (share) => setMaking((m) => (m.kind === "making" ? { kind: "making", share } : m)),
      controller.signal,
    )
      .then((uri) => {
        if (!controller.signal.aborted) setMaking({ kind: "ready", uri });
      })
      .catch(() => {
        if (!controller.signal.aborted) return setMaking({ kind: "failed" });
        setMaking(why.current === "cancel" ? { kind: "cancelled" } : { kind: "preparing" });
      });
    return () => controller.abort();
  }, [encoder, hidden, scene, fonts, images, run]);

  // The preview's sound is the file's own soundtrack, muted by the speaker; none while balances are hidden.
  const ready = making.kind === "ready" ? making.uri : null;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    if (!ready || hidden) return;
    // The session stays active between plays (D5: a pause or a cue could end it under the next play).
    const p = createAudioPlayer({ uri: ready }, { keepAudioSessionActive: true });
    p.muted = !soundRef.current;
    player.current = p;
    return () => {
      p.remove();
      player.current = null;
    };
  }, [ready, hidden]);
  useEffect(() => {
    if (player.current) player.current.muted = !sound;
  }, [sound, ready, hidden]);
  // Leaving the sheet hands the silent switch back to the app's cues.
  useEffect(() => () => void replayAudio(false), []);

  const ended = () => {
    setPlaying(false);
    void replayAudio(false);
  };
  const pause = () => {
    cancelAnimation(t);
    player.current?.pause();
    setPlaying(false);
    void replayAudio(false);
  };
  const start = (from: number) => {
    t.value = from;
    t.value = withTiming(totalMs, { duration: totalMs - from, easing: Easing.linear }, (done) => {
      if (done) runOnJS(ended)();
    });
  };
  // The sound is made ready first — heard with the silent switch on, loaded, at the picture's place — then both start
  // together (D5: playing before it had loaded, or before the seek landed, was silent or out of step).
  const play = async () => {
    const from = t.value >= totalMs ? 0 : t.value;
    setPlaying(true);
    const p = player.current;
    if (p) {
      await replayAudio(true);
      await whenLoaded(p);
      await p.seekTo(from / MS, 0, 0);
      p.play();
    }
    start(from);
  };
  useEffect(() => {
    if (hidden) {
      cancelAnimation(t);
      player.current?.pause();
      setPlaying(false);
    }
  }, [hidden, t]);

  const status: { text: string; action?: { label: string; onPress: () => void } } | null = hidden
    ? { text: "Balances hidden", action: { label: "Show balances", onPress: () => setHidden(false) } }
    : !scene
      ? { text: "Replay unavailable" }
      : !encoder
        ? { text: "Can't save replay here" }
        : making.kind === "preparing"
          ? { text: "Preparing replay" }
          : making.kind === "making"
            ? {
                text: `Making replay · ${Math.round(making.share * PERCENT)}%`,
                action: {
                  label: "Cancel",
                  onPress: () => {
                    why.current = "cancel";
                    abort.current?.abort();
                  },
                },
              }
            : making.kind === "failed"
              ? { text: "Couldn't make replay", action: { label: "Retry", onPress: () => setRun((n) => n + 1) } }
              : making.kind === "cancelled"
                ? { text: "Cancelled", action: { label: "Make replay", onPress: () => setRun((n) => n + 1) } }
                : { text: "Ready" };
  const busy = !hidden && encoder && making.kind === "making";
  // With its sound on the way, Play waits for the file (D5: playing during the making was silent and restarted it).
  const waiting = !hidden && encoder && (making.kind === "making" || making.kind === "preparing");
  const blocked = ready ? undefined : "";
  const muted = { color: color.inkMuted };
  return (
    <Sheet onClose={onClose} closeLabel="Close the replay" detents={[DETENT]}>
      <SheetHeading title="Replay" />
      <FilmAssets
        symbol={film.input.symbol}
        avatar={identity?.avatar ?? null}
        address={owner}
        url={url}
        onReady={setImages}
      />
      <View style={styles.body}>
        <View style={[styles.preview, { height: previewH }]}>
          {scene && fonts && images && previewW > 0 ? (
            <FilmPreview
              frames={scene.frames}
              totalMs={totalMs}
              words={scene.words}
              colours={FILM_COLOURS}
              fonts={fonts}
              images={images}
              width={previewW}
              t={t}
              onSeek={pause}
            />
          ) : null}
        </View>
        <View style={[styles.row, { minHeight: TRANSPORT }]}>
          <Pressable
            onPress={() => {
              fire("tick");
              if (playing) pause();
              else void play();
            }}
            disabled={!scene || waiting}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause" : waiting ? "Play, once the replay is made" : "Play"}
            style={styles.square}
          >
            {playing ? <Pause size={SIZE.icon} color={color.ink} /> : <PlayFill size={SIZE.icon} color={color.ink} />}
          </Pressable>
          {scene ? <Scrubber t={t} totalMs={totalMs} onSeek={pause} label="Replay position" /> : null}
          <Text style={[TYPE.caption, muted, styles.clock]}>
            {clock(Math.min(totalMs, second * MS))} / {clock(totalMs)}
          </Text>
          <Pressable
            onPress={() => {
              fire("tick", { cue: "toggle" });
              setSound((on) => !on);
            }}
            accessibilityRole="switch"
            accessibilityLabel="Sound in replay"
            accessibilityState={{ checked: sound }}
            style={styles.square}
          >
            {sound ? (
              <Volume size={SIZE.icon} color={color.ink} />
            ) : (
              <VolumeX size={SIZE.icon} color={color.inkMuted} />
            )}
          </Pressable>
        </View>
        {status ? (
          <View style={[styles.row, { minHeight: STATUS }]}>
            <View style={styles.grow}>
              <Text style={[TYPE.rowDetail, muted]}>{status.text}</Text>
              {making.kind === "making" && !hidden ? (
                <View style={[styles.rail, { backgroundColor: color.hairline }]}>
                  <View style={[styles.rail, { backgroundColor: color.ink, width: `${making.share * PERCENT}%` }]} />
                </View>
              ) : null}
            </View>
            {status.action ? (
              <Pressable
                onPress={() => {
                  fire("tick");
                  status.action?.onPress();
                }}
                accessibilityRole="button"
                hitSlop={SPACE.sm}
              >
                <Text style={[TYPE.rowTitle, { color: color.ink }]}>{status.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <ActionCircles>
          <ActionCircle
            icon={Share}
            label="Share"
            primary
            busy={busy}
            reason={busy ? undefined : blocked}
            onPress={() => {
              // Closing the share sheet isn't an error.
              if (ready) void shareVideo(ready).catch(() => undefined);
            }}
          />
          <ActionCircle
            icon={Download}
            label="Save"
            busy={busy}
            reason={busy ? undefined : blocked}
            onPress={() => {
              if (!ready) return;
              void saveToPhotos(ready)
                .then((result) =>
                  notify(
                    result === "saved"
                      ? { title: "Saved to Photos" }
                      : result === "refused"
                        ? { title: "Photos access is off", description: "Share still saves it.", tone: "warning" }
                        : { title: "Can't save here yet", description: "Share still saves it.", tone: "warning" },
                  ),
                )
                .catch(() => notify({ title: "Couldn't save the replay", tone: "warning" }));
            }}
          />
        </ActionCircles>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md, paddingBottom: SPACE.lg },
  preview: { alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  square: { width: ROW, height: ROW, alignItems: "center", justifyContent: "center" },
  clock: { fontVariant: ["tabular-nums"] },
  grow: { flex: 1, gap: SPACE.xs },
  rail: { height: RAIL, borderRadius: RAIL },
});
