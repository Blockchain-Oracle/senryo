/**
 * The replay video as an MP4 (Q3, D-350; Codex direction 17 §4): 1080 × 1350 at 30 fps, H.264 about 6 Mbps with AAC
 * 128 kbps, every frame drawn at t = i / 30 by the preview's own worklet — never a screen recording. The soundtrack is
 * the film's cue track: each cue's rendered WAV (the same files the app plays) placed at its time, at the reference mix.
 * The encoder is a native module in runtime 0.5.0: on an older binary `canSaveVideo()` is false and nothing loads it.
 * Then Save writes the file to Photos (add-only access, asked on that tap) and Share hands it to the share sheet.
 */

import type { DrawnFrame, FilmColours, FilmWords } from "@senryo/calls";
import { FILM_LAYOUT } from "@senryo/calls";
import { SOUND_MASTER, SOUND_MIX, type SoundCue } from "@senryo/tokens";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { Asset as LibraryAsset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { TurboModuleRegistry } from "react-native";
import { CUE_SOURCES, LADDER_SOURCES } from "~/feedback/cue-sources";
import { drawFilmFrame, type FilmFonts, type FilmImages } from "./drawFilm";

const FILM_W = FILM_LAYOUT.frame.w;
const FILM_H = FILM_LAYOUT.frame.h;

const FPS = 30;
const MS = 1_000;
const VIDEO_BITRATE = 6_000_000;
const AUDIO_BITRATE = 128_000;
const FILE_PREFIX = /^file:\/\//;
/** RIFF/WAVE header offsets: the byte rate and the data chunk's size (the canonical 44-byte header gen-sounds writes). */
const WAV = { byteRate: 28, dataSize: 40 } as const;
const UINT32 = 4;

export const canSaveVideo = (): boolean => TurboModuleRegistry.get("ReactNativeSkiaVideo") != null;

async function cueFile(cue: string, step: number): Promise<{ path: string; seconds: number } | null> {
  const source =
    cue === "profit" ? LADDER_SOURCES.profit[step] : (CUE_SOURCES as Record<string, number | undefined>)[cue];
  if (typeof source !== "number") return null;
  const asset = await Asset.fromModule(source).downloadAsync();
  if (!asset.localUri) return null;
  const bytes = await new File(asset.localUri).bytes();
  const view = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, WAV.dataSize + UINT32));
  const rate = view.getUint32(WAV.byteRate, true);
  const size = view.getUint32(WAV.dataSize, true);
  return rate > 0 ? { path: asset.localUri.replace(FILE_PREFIX, ""), seconds: size / rate } : null;
}

export interface FilmExport {
  frames: DrawnFrame[];
  totalMs: number;
  words: FilmWords;
  colours: FilmColours;
  fonts: FilmFonts;
  images: FilmImages;
  cues: { at: number; cue: string; step: number }[];
  sound: boolean;
}

/** Makes the MP4 and returns its file URI. */
export async function exportFilm(
  e: FilmExport,
  onProgress: (share: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const { exportVideoComposition } =
    require("@azzapp/react-native-skia-video") as typeof import("@azzapp/react-native-skia-video");
  const duration = e.totalMs / MS;
  const audio = e.sound
    ? (
        await Promise.all(
          e.cues.map(async (c, i) => {
            const file = await cueFile(c.cue, c.step);
            if (!file) return null;
            const start = c.at / MS;
            return {
              id: `cue-${i}`,
              kind: "audio" as const,
              path: file.path,
              compositionStartTime: start,
              startTime: 0,
              duration: Math.min(file.seconds, duration - start),
              volume: SOUND_MASTER * (SOUND_MIX[c.cue as SoundCue] ?? 1),
            };
          }),
        )
      ).filter((x): x is NonNullable<typeof x> => x !== null && x.duration > 0)
    : [];
  const out = new File(Paths.cache, `senryo-replay-${Date.now()}.mp4`);
  const { frames, words, colours, fonts, images } = e;
  await exportVideoComposition({
    videoComposition: { duration, items: audio },
    drawFrame: ({ canvas, currentTime }) => {
      "worklet";
      const frame = frames[Math.min(frames.length - 1, Math.round(currentTime * FPS))];
      if (frame) drawFilmFrame(canvas, frame, words, colours, fonts, images);
    },
    outPath: out.uri.replace(FILE_PREFIX, ""),
    width: FILM_W,
    height: FILM_H,
    frameRate: FPS,
    bitRate: VIDEO_BITRATE,
    audioBitRate: AUDIO_BITRATE,
    abortSignal: signal,
    onProgress: ({ framesCompleted, nbFrames }) => onProgress(nbFrames > 0 ? framesCompleted / nbFrames : 0),
  });
  return out.uri;
}

/** Saves the video to Photos; false when access was refused (Share still works). */
export async function saveVideo(uri: string): Promise<boolean> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return false;
  await LibraryAsset.create(uri);
  return true;
}

export const shareVideo = (uri: string) =>
  Sharing.shareAsync(uri, { mimeType: "video/mp4", UTI: "public.mpeg-4", dialogTitle: "Share the replay" });
