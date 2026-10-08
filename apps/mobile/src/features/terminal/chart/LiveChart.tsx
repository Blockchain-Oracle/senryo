/**
 * The terminal's live chart (S5, D-272 budgets): ticks from `@senryo/live` land in a shared value; a frame callback on
 * the UI thread eases, samples and rolls the digits; a picture is re-recorded each frame from that state. React renders
 * only on layout and when the market changes — never per tick (the overlay is a shared value too).
 */
import { useLive, useLiveStream } from "@senryo/live/react";
import { Canvas, matchFont, Picture, Skia, useFont } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { type LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import {
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { setOdometer, setOdometerTrend } from "~/components/kit/odometer";
import { useTheme } from "~/theme";
import { CHART_ERASER } from "~/theme/palette";
import { LEVEL_DASH } from "./constants";
import { type ChartOverlay, type DrawKit, drawFrame } from "./draw";
import { formatUsd, priceDecimals } from "./engine";
import { advance, createChartState, resetChart, takePrice } from "./state";

const E8 = 1e8;
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const FONT_SIZE = { axis: 11, pill: 13, pillSmall: 11, tag: 10 } as const;
const MARK_FONT_SIZE = 96;
const MARK = "千両";
/** The dot field moves with the plot, which ends before the pill; this estimate only paces the dots. */
const PILL_ALLOWANCE = 110;

export interface LiveChartProps {
  symbol: string;
  /** The open call's overlay, written per tick by `useLiveQuote` (a shared value: no React render). */
  overlay: SharedValue<ChartOverlay | null>;
  /** Shown before the first tick ("Waiting for BTC…"). */
  waiting: string;
}

export function LiveChart({ symbol, overlay, waiting }: LiveChartProps) {
  const live = useLive();
  useLiveStream();
  const { color } = useTheme();
  const reduced = useReducedMotion();
  const markFont = useFont(require("../../../../assets/fonts/NotoSansJP-Bold-subset.ttf"), MARK_FONT_SIZE);

  const kit = useMemo<DrawKit>(
    () => ({
      paint: Skia.Paint(),
      line: Skia.PathBuilder.Make(),
      zone: Skia.PathBuilder.Make(),
      fonts: {
        axis: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.axis }),
        pill: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.pill, fontWeight: "bold" }),
        pillSmall: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.pillSmall, fontWeight: "bold" }),
        tag: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.tag, fontWeight: "bold" }),
        mark: markFont,
      },
      colors: {
        up: Skia.Color(color.chartUp),
        down: Skia.Color(color.chartDown),
        ink: Skia.Color(color.ink),
        inverse: Skia.Color(color.ground),
        helper: Skia.Color(color.inkMuted),
        onLine: Skia.Color(color.paperInk),
      },
      dash: {
        line: Skia.PathEffect.MakeDash([...LEVEL_DASH.line], 0),
        entry: Skia.PathEffect.MakeDash([...LEVEL_DASH.entry], 0),
      },
      fade: {
        solid: Skia.Color(CHART_ERASER.solid),
        mid: Skia.Color(CHART_ERASER.mid),
        clear: Skia.Color(CHART_ERASER.clear),
      },
      mark: MARK,
    }),
    [color, markFont],
  );
  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const state = useSharedValue(createChartState());
  const incoming = useSharedValue({ seq: 0, price: 0 });
  const overlayValue = overlay;
  const size = useSharedValue({ w: 0, h: 0 });
  const clock = useSharedValue(0);

  // A new market starts a fresh flat line at its first tick.
  useEffect(() => {
    state.modify((s) => {
      "worklet";
      resetChart(s);
      return s;
    });
    let seq = 0;
    const push = () => {
      const t = live.prices.latest(symbol);
      if (!t) return;
      seq += 1;
      incoming.value = { seq, price: t.priceE8 / E8 };
    };
    push();
    return live.prices.subscribe(symbol, push);
  }, [live, symbol, state, incoming]);

  useFrameCallback((frame) => {
    "worklet";
    const plotW = Math.max(0, size.value.w - PILL_ALLOWANCE);
    state.modify((s) => {
      "worklet";
      const tick = incoming.value;
      if (tick.seq !== s.seenSeq) {
        s.seenSeq = tick.seq;
        takePrice(s, tick.price);
      }
      advance(s, frame.timestamp, reduced, plotW);
      if (s.ready) setOdometer(s.price, formatUsd(s.latest, priceDecimals(s.latest)), s.latest);
      const o = overlayValue.value;
      if (o?.pnlText) setOdometerTrend(s.pnl, o.pnlText, o.pnlTrend);
      return s;
    });
    clock.value = frame.timestamp;
  });

  const picture = useDerivedValue(() => {
    "worklet";
    const { w, h } = size.value;
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
    if (clock.value > 0 && w > 0) drawFrame(canvas, kit, state.value, overlayValue.value, w, h, waiting);
    return recorder.finishRecordingAsPicture();
  });

  const onLayout = (e: LayoutChangeEvent) => {
    size.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View style={styles.fill} onLayout={onLayout} accessible accessibilityLabel={`${symbol} live price chart`}>
      <Canvas style={styles.fill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
