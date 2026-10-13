/**
 * The replay as an MP4 on the web (Q3, D-350; Codex direction 17 §4): every frame drawn into an OffscreenCanvas at
 * t = i / 30 by the preview's own `drawFilmFrame` — never a screen recording — and encoded with Mediabunny (WebCodecs):
 * H.264 about 6 Mbps at 1080 × 1350, AAC 128 kbps. The soundtrack is the live terminal's price sounds (`filmSound`), no
 * music: every cue rendered offline through the same voices the app plays, at its time. Where the browser can't encode
 * H.264 at this size it says so — never a silent WebM.
 */
import { type DrawnFrame, type FilmColours, type FilmSound, type FilmWords, FILM_LAYOUT as L } from "@senryo/calls";
import { ladderRate, SOUND_CUES, SOUND_MASTER, SOUND_MIX, type SoundCue } from "@senryo/tokens";
import { bookVoice } from "@/lib/feedback/sound";
import { drawFilmFrame, type FilmFaces, type FilmImagesWeb } from "./drawFilm";

const FPS = 30;
const MS = 1_000;
const VIDEO_BITRATE = 6_000_000;
const AUDIO_BITRATE = 128_000;
const SAMPLE_RATE = 44_100;
const CHANNELS = 2;

export class VideoUnavailable extends Error {}

export interface FilmExportWeb extends FilmSound {
  frames: DrawnFrame[];
  totalMs: number;
  words: FilmWords;
  colours: FilmColours;
  faces: FilmFaces;
  images: FilmImagesWeb;
}

/** The soundtrack, rendered offline: every cue through the app's own voices. */
export async function soundtrack(e: FilmExportWeb): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(CHANNELS, Math.ceil((SAMPLE_RATE * e.totalMs) / MS), SAMPLE_RATE);
  const out = ctx.createGain();
  out.gain.value = SOUND_MASTER;
  out.connect(ctx.destination);
  for (const c of e.cues) {
    const cue = c.cue as SoundCue;
    const voices = SOUND_CUES[cue];
    if (!voices) continue;
    const rate = cue === "profit" ? ladderRate("profit", c.step) : 1;
    for (const v of voices) bookVoice(ctx, out, v, c.at / MS + v.at, SOUND_MIX[cue], rate);
  }
  return ctx.startRendering();
}

/** Makes the MP4 (a Blob). Throws `VideoUnavailable` where the browser can't encode it. */
export async function exportFilm(
  e: FilmExportWeb,
  onProgress: (share: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const mb = await import("mediabunny");
  const size = { width: L.frame.w, height: L.frame.h, bitrate: VIDEO_BITRATE };
  if (typeof OffscreenCanvas === "undefined" || !(await mb.canEncodeVideo("avc", size))) throw new VideoUnavailable();
  const canvas = new OffscreenCanvas(L.frame.w, L.frame.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new VideoUnavailable();
  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new mb.BufferTarget(),
  });
  const video = new mb.CanvasSource(canvas, { codec: "avc", bitrate: VIDEO_BITRATE });
  output.addVideoTrack(video, { frameRate: FPS });
  const withSound = await mb.canEncodeAudio("aac");
  const audio = withSound ? new mb.AudioBufferSource({ codec: "aac", bitrate: AUDIO_BITRATE }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();
  try {
    for (let i = 0; i < e.frames.length; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const frame = e.frames[i];
      if (frame) drawFilmFrame(ctx, frame, e.words, e.colours, e.faces, e.images);
      await video.add(i / FPS, 1 / FPS);
      onProgress(i / e.frames.length);
    }
    if (audio) await audio.add(await soundtrack(e));
    await output.finalize();
  } catch (error) {
    await output.cancel();
    throw error;
  }
  const buffer = output.target.buffer;
  if (!buffer) throw new VideoUnavailable();
  return new Blob([buffer], { type: "video/mp4" });
}

/** Save video: a download of the file. */
export function downloadVideo(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), MS);
}

/** Share video: the share sheet with the file where the browser can share files; false where it can't. */
export async function shareVideo(blob: Blob, name: string, title: string): Promise<boolean> {
  const file = new File([blob], name, { type: "video/mp4" });
  if (!navigator.canShare?.({ files: [file] })) return false;
  await navigator.share({ files: [file], title });
  return true;
}
