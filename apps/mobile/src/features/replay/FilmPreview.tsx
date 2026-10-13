/**
 * The replay in the app (Q3, D-350; Codex direction 18 §B): the whole 4:5 frame scaled to the width it's given, drawn
 * on the UI thread by the same worklet the exporter uses — so the preview is the post. It draws the frame at `t`, the
 * sheet's one clock (the transport, the clock text and the sound follow the same value); a horizontal drag scrubs
 * (vertical movement stays the sheet's) and tells the sheet, which pauses.
 */

import type { DrawnFrame, FilmColours, FilmWords } from "@senryo/calls";
import { FILM_LAYOUT } from "@senryo/calls";
import { Canvas, Picture, Skia } from "@shopify/react-native-skia";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, type SharedValue, useDerivedValue } from "react-native-reanimated";
import { drawFilmFrame, type FilmFonts, type FilmImages } from "./drawFilm";

const FILM_W = FILM_LAYOUT.frame.w;
const FILM_H = FILM_LAYOUT.frame.h;

const FPS = 30;
const MS = 1_000;
/** A drag moves this far horizontally before it scrubs. */
const SCRUB_SLOP = 8;

export function FilmPreview({
  frames,
  totalMs,
  words,
  colours,
  fonts,
  images,
  width,
  t,
  onSeek,
}: {
  frames: DrawnFrame[];
  totalMs: number;
  words: FilmWords;
  colours: FilmColours;
  fonts: FilmFonts;
  images: FilmImages;
  width: number;
  /** Film time (ms), owned by the sheet. */
  t: SharedValue<number>;
  /** A drag has started moving the time: the sheet pauses. */
  onSeek: () => void;
}) {
  const scale = width / FILM_W;
  const picture = useDerivedValue(() => {
    const i = Math.min(frames.length - 1, Math.max(0, Math.round((t.value / MS) * FPS)));
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, width * (FILM_H / FILM_W)));
    canvas.scale(scale, scale);
    const frame = frames[i];
    if (frame) drawFilmFrame(canvas, frame, words, colours, fonts, images);
    return recorder.finishRecordingAsPicture();
  });
  const scrub = Gesture.Pan()
    .activeOffsetX([-SCRUB_SLOP, SCRUB_SLOP])
    .failOffsetY([-SCRUB_SLOP, SCRUB_SLOP])
    .onStart(() => {
      runOnJS(onSeek)();
    })
    .onUpdate((e) => {
      t.value = Math.min(totalMs, Math.max(0, (e.x / width) * totalMs));
    });
  return (
    <GestureDetector gesture={scrub}>
      <View style={{ width, height: width * (FILM_H / FILM_W) }}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
