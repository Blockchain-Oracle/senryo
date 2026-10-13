/**
 * The replay video in the app (Q3, D-350; Codex direction 17 §4): the whole 4:5 frame scaled to the width it's given,
 * drawn on the UI thread by the same worklet the exporter uses — so the preview is the post. It opens paused on the last
 * frame (the poster); Play runs it from the start; a horizontal drag scrubs (vertical movement stays the sheet's).
 * Reduce Motion opens still and plays only when asked.
 */
import { Canvas, Picture, Skia } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  type DrawnFrame,
  drawFilmFrame,
  type FilmColours,
  type FilmFonts,
  type FilmImages,
  type FilmWords,
} from "./drawFilm";
import { FILM_H, FILM_W } from "./film-layout";

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
  playing,
  onEnd,
  onLayout,
}: {
  frames: DrawnFrame[];
  totalMs: number;
  words: FilmWords;
  colours: FilmColours;
  fonts: FilmFonts;
  images: FilmImages;
  width: number;
  playing: boolean;
  onEnd: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const t = useSharedValue(totalMs);
  const scale = width / FILM_W;
  useEffect(() => {
    if (playing) {
      const from = t.value >= totalMs ? 0 : t.value;
      t.value = from;
      t.value = withTiming(totalMs, { duration: totalMs - from, easing: Easing.linear });
    } else {
      cancelAnimation(t);
    }
  }, [playing, totalMs, t]);
  useAnimatedReaction(
    () => t.value >= totalMs,
    (end, was) => {
      if (end && was === false) runOnJS(onEnd)();
    },
  );
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
    .onUpdate((e) => {
      cancelAnimation(t);
      t.value = Math.min(totalMs, Math.max(0, (e.x / width) * totalMs));
    });
  return (
    <GestureDetector gesture={scrub}>
      <View onLayout={onLayout} style={{ width, height: width * (FILM_H / FILM_W) }}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
