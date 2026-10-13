/**
 * A finished trade's replay on the phone (R5.19; the web's `Replay`, Owarine's `ReplaySheet`): the price path this
 * phone recorded while it was open, drawn as it plays back in at most 12 s — a Skia path trimmed on the UI thread to
 * where the time has reached, its head in the colour of the PnL then — with that PnL beside it, the entry (and a
 * call's line) dashed behind, Play / Pause / Again, and a drag across it scrubs. Shown only when this phone recorded
 * enough of the trade.
 */
import { type Episode, playMs, pnlAt, replayable } from "@senryo/calls";
import { useEpisode } from "@senryo/calls/react";
import { signedUsd } from "@senryo/core";
import { Canvas, Circle, DashPathEffect, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SPACE, TYPE, useTheme } from "~/theme";
import { withAlpha } from "~/theme/palette";

const HEIGHT = 160;
const PAD = 8;
const RANGE_PAD = 0.15;
const MIN_RANGE_SHARE = 0.0001;
const STROKE = 2;
const DOT = 4;
const LEVEL_ALPHA = 0.6;
const DASH = { entry: 4, line: 2, lineGap: 3 } as const;
const DASH_ENTRY = [DASH.entry, DASH.entry];
const DASH_LINE = [DASH.line, DASH.lineGap];
/** The PnL beside the path updates in this many steps over the playback. */
const PNL_STEPS = 100;
const SECOND_MS = 1_000;
const MINUTE_S = 60;
const HOUR_S = 3_600;

const lifeText = (ms: number) => {
  const s = Math.max(0, Math.round(ms / SECOND_MS));
  return s < MINUTE_S ? `${s}s` : s < HOUR_S ? `${Math.round(s / MINUTE_S)}m` : `${(s / HOUR_S).toFixed(1)}h`;
};

/** The path in screen space, with each sample's share of the time and of the path's length (the trim follows time). */
function geometry(e: Episode, w: number) {
  const s = e.samples;
  const t0 = s[0]?.[0] ?? 0;
  const t1 = s.at(-1)?.[0] ?? t0;
  const prices = [...s.map((x) => x[1]), ...(e.entry ? [e.entry] : []), ...(e.line ? [e.line] : [])];
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  const pad = Math.max((hi - lo) * RANGE_PAD, hi * MIN_RANGE_SHARE);
  lo -= pad;
  hi += pad;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (w - PAD * 2) + PAD;
  const y = (p: number) => HEIGHT - PAD - ((p - lo) / (hi - lo)) * (HEIGHT - PAD * 2);
  const xs = s.map(([t]) => x(t));
  const ys = s.map(([, p]) => y(p));
  const path = Skia.Path.Make();
  const lens = [0];
  xs.forEach((px, i) => {
    const py = ys[i] ?? 0;
    if (i === 0) path.moveTo(px, py);
    else {
      path.lineTo(px, py);
      lens.push((lens[i - 1] ?? 0) + Math.hypot(px - (xs[i - 1] ?? 0), py - (ys[i - 1] ?? 0)));
    }
  });
  const total = Math.max(1, lens.at(-1) ?? 1);
  return {
    path,
    xs,
    ys,
    ts: s.map(([t]) => (t - t0) / Math.max(1, t1 - t0)),
    ls: lens.map((l) => l / total),
    entryY: e.entry ? y(e.entry) : null,
    lineY: e.line ? y(e.line) : null,
    life: t1 - t0,
    t0,
  };
}

/** The replay of a finished trade when this phone recorded it (nothing otherwise). */
export function ReplayFor({ chainId, bookKey }: { chainId: number; bookKey: string }) {
  const episode = useEpisode(chainId, bookKey);
  return episode && replayable(episode) ? <Replay episode={episode} /> : null;
}

export function Replay({ episode: e }: { episode: Episode }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const [w, setW] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [at, setAt] = useState(0);
  const progress = useSharedValue(0);
  const g = useMemo(() => (w > 0 ? geometry(e, w) : null), [e, w]);
  const span = playMs(e);

  useEffect(() => {
    if (!playing) return;
    const left = 1 - progress.value;
    if (left <= 0) return;
    progress.value = withTiming(1, { duration: left * span, easing: Easing.linear }, (done) => {
      if (done) runOnJS(setPlaying)(false);
    });
    return () => cancelAnimation(progress);
  }, [playing, progress, span]);

  useAnimatedReaction(
    () => Math.round(progress.value * PNL_STEPS),
    (step, prev) => {
      if (step !== prev) runOnJS(setAt)(step / PNL_STEPS);
    },
  );

  const ts = g?.ts ?? [0, 1];
  const end = useDerivedValue(() => (g ? interpolate(progress.value, ts, g.ls) : 0));
  const cx = useDerivedValue(() => (g ? interpolate(progress.value, ts, g.xs) : 0));
  const cy = useDerivedValue(() => (g ? interpolate(progress.value, ts, g.ys) : 0));

  const scrub = Gesture.Pan()
    .onBegin((ev) => {
      cancelAnimation(progress);
      runOnJS(setPlaying)(false);
      progress.value = Math.min(1, Math.max(0, ev.x / Math.max(1, w)));
    })
    .onChange((ev) => {
      progress.value = Math.min(1, Math.max(0, ev.x / Math.max(1, w)));
    });

  const pnl = g ? pnlAt(e.samples, g.t0 + g.life * at) : 0n;
  const tone = pnl >= 0n ? color.up : color.down;
  const done = at >= 1 && !playing;
  return (
    <View style={styles.wrap} accessibilityLabel={`Replay of ${e.symbol} ${e.label}`}>
      <View style={styles.head}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Replay · {g ? lifeText(g.life) : ""}</Text>
        <Text style={[TYPE.numMd, { color: tone }]}>{masked(signedUsd(pnl), hidden)}</Text>
      </View>
      <GestureDetector gesture={scrub}>
        <View onLayout={(ev: LayoutChangeEvent) => setW(ev.nativeEvent.layout.width)} style={styles.chart}>
          {g ? (
            <Canvas style={StyleSheet.absoluteFill}>
              {g.entryY !== null ? (
                <Line p1={vec(0, g.entryY)} p2={vec(w, g.entryY)} color={withAlpha(color.text3, LEVEL_ALPHA)}>
                  <DashPathEffect intervals={DASH_ENTRY} />
                </Line>
              ) : null}
              {g.lineY !== null ? (
                <Line p1={vec(0, g.lineY)} p2={vec(w, g.lineY)} color={withAlpha(color.text3, LEVEL_ALPHA)}>
                  <DashPathEffect intervals={DASH_LINE} />
                </Line>
              ) : null}
              <Path
                path={g.path}
                start={0}
                end={end}
                color={tone}
                style="stroke"
                strokeWidth={STROKE}
                strokeJoin="round"
                strokeCap="round"
              />
              <Circle cx={cx} cy={cy} r={DOT} color={tone} />
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      <Button
        label={done ? "Play again" : playing ? "Pause" : "Play"}
        variant="secondary"
        size="sm"
        block={false}
        onPress={() => {
          fire("tick");
          if (done) progress.value = 0;
          setPlaying(done || !playing);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  chart: { height: HEIGHT },
});
