/**
 * Win confetti (Owarine's toasts `Confetti`, Tradash's win burst; 21st.dev motiondotdev/motion-confetti #24692 for the
 * shape mix): two emitters at 18 % and 82 % of the width near the bottom, 34 pieces each, launched upward and outward,
 * slowed by drag and pulled by gravity, fading over the second half of 1.1 s. Rectangles, strips and dots in the
 * Senryo colours. Stepped and drawn on the UI thread (Skia picture per frame); nothing for Reduce Motion.
 */
import { Canvas, Picture, type SkColor, Skia } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from "react-native-reanimated";

const PER_EMITTER = 34;
const LEFT_EMITTER = 0.18;
const RIGHT_EMITTER = 0.82;
const EMITTERS = [LEFT_EMITTER, RIGHT_EMITTER] as const;
const ORIGIN_Y = 0.86;
const LIFE_MS = 1_100;
const FADE_FROM = 0.5;
const SPEED_MIN = 3.6;
const SPEED_SPREAD = 3.4;
const SPREAD = 0.9;
const OUTWARD = 0.42;
const GRAVITY = 0.14;
const DRAG_MIN = 0.982;
const DRAG_SPREAD = 0.012;
const SPIN = 0.4;
const W_MIN = 4;
const W_SPREAD = 4;
const H_MIN = 6;
const H_SPREAD = 6;
const STRIP_RATIO = 2.4;
/** Physics steps per 60 Hz frame (the reference integrates per animation frame). */
const MS_PER_SECOND = 1_000;
const FRAMES_PER_SECOND = 60;
const FRAME_MS = MS_PER_SECOND / FRAMES_PER_SECOND;
const HALF = 2;
const DOT = 0;
const STRIP = 2;
const SHAPES = 3;
const DEGREES_PER_HALF_TURN = 180;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  r: number;
  vr: number;
  drag: number;
  c: number;
  shape: number;
}

function launch(width: number, height: number, colours: number): Piece[] {
  return EMITTERS.flatMap((fx) =>
    Array.from({ length: PER_EMITTER }, () => {
      const speed = SPEED_MIN + Math.random() * SPEED_SPREAD;
      const angle = -Math.PI / HALF + (Math.random() - FADE_FROM) * SPREAD + (fx < FADE_FROM ? -OUTWARD : OUTWARD);
      return {
        x: width * fx,
        y: height * ORIGIN_Y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: W_MIN + Math.random() * W_SPREAD,
        h: H_MIN + Math.random() * H_SPREAD,
        r: Math.random() * Math.PI,
        vr: (Math.random() - FADE_FROM) * SPIN,
        drag: DRAG_MIN + Math.random() * DRAG_SPREAD,
        c: Math.floor(Math.random() * colours),
        shape: Math.floor(Math.random() * SHAPES),
      };
    }),
  );
}

/** One burst per change of `burst` (0 = none yet). */
export function Confetti({ burst, colours }: { burst: number; colours: readonly string[] }) {
  const reduce = useReducedMotion();
  const size = useSharedValue({ w: 0, h: 0 });
  const pieces = useSharedValue<Piece[]>([]);
  const started = useSharedValue(0);
  const now = useSharedValue(0);
  const paint = useMemo(() => Skia.Paint(), []);
  const skColours = useMemo<SkColor[]>(() => colours.map((c) => Skia.Color(c)), [colours]);
  const recorder = useMemo(() => Skia.PictureRecorder(), []);

  useEffect(() => {
    if (burst === 0 || reduce) return;
    const { w, h } = size.value;
    if (w === 0) return;
    pieces.value = launch(w, h, colours.length);
    started.value = 0;
  }, [burst, reduce, size, pieces, started, colours.length]);

  useFrameCallback((frame) => {
    "worklet";
    if (pieces.value.length === 0) return;
    if (started.value === 0) started.value = frame.timestamp;
    const t = (frame.timestamp - started.value) / LIFE_MS;
    if (t >= 1) {
      pieces.value = [];
      return;
    }
    const steps = Math.max(1, Math.round((frame.timeSincePreviousFrame ?? FRAME_MS) / FRAME_MS));
    pieces.modify((list) => {
      "worklet";
      for (const p of list)
        for (let i = 0; i < steps; i += 1) {
          p.vy += GRAVITY;
          p.vx *= p.drag;
          p.vy *= p.drag;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
        }
      return list;
    });
    now.value = t;
  });

  const picture = useDerivedValue(() => {
    const { w, h } = size.value;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(1, w), Math.max(1, h)));
    const t = now.value;
    const list = pieces.value;
    if (list.length > 0) {
      for (const p of list) {
        const colour = skColours[p.c];
        if (colour) paint.setColor(colour);
        paint.setAlphaf(t < FADE_FROM ? 1 : 1 - (t - FADE_FROM) / FADE_FROM);
        c.save();
        c.translate(p.x, p.y);
        c.rotate((p.r * DEGREES_PER_HALF_TURN) / Math.PI, 0, 0);
        if (p.shape === DOT) c.drawCircle(0, 0, p.w / HALF, paint);
        else {
          const ph = p.shape === STRIP ? p.w * STRIP_RATIO : p.h;
          const pw = p.shape === STRIP ? p.w / HALF : p.w;
          c.drawRect(Skia.XYWHRect(-pw / HALF, -ph / HALF, pw, ph), paint);
        }
        c.restore();
      }
    }
    return recorder.finishRecordingAsPicture();
  });

  const onLayout = (e: LayoutChangeEvent) => {
    size.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityElementsHidden>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
