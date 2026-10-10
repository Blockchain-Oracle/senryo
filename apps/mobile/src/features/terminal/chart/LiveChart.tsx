/**
 * The terminal's live chart (S5, D-272 budgets): ticks from `@senryo/live` land in a shared value; a frame callback on
 * the UI thread eases, samples and rolls the digits; a picture is re-recorded each frame from that state. React renders
 * only on layout and when the market changes — never per tick (the overlay is a shared value too).
 */
import { unitOf } from "@senryo/calls";
import { fillLine } from "@senryo/live";
import { useLive, useLiveStream } from "@senryo/live/react";
import { Canvas, matchFont, Picture, Skia, useFont } from "@shopify/react-native-skia";
import { memo, useEffect, useMemo } from "react";
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
import { type ChartHealth, LEVEL_DASH, LIVE, RESEED_WINDOW_MS } from "./constants";
import { type ChartOverlay, drawFrame, type Head } from "./draw";
import { formatValue, priceDecimals, SAMPLE_CAPACITY, SAMPLE_MS } from "./engine";
import { type DrawKit, makeDotPicture, makeKit } from "./kit";
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
  /** Where the line's head is, written every frame (the reactions ride it; null while waiting). */
  head?: SharedValue<Head | null>;
  /** The price's health (R1.20): not live → the line freezes, dims and shows its age or state. */
  health?: SharedValue<ChartHealth>;
}

/** Memoised: its props are stable, so the terminal's once-a-second countdown render never reaches the chart. */
export const LiveChart = memo(function LiveChart({ symbol, overlay, waiting, head, health }: LiveChartProps) {
  const live = useLive();
  useLiveStream();
  const { color } = useTheme();
  const reduced = useReducedMotion();
  const markFont = useFont(require("../../../../assets/fonts/NotoSansJP-Bold-subset.ttf"), MARK_FONT_SIZE);

  const points = unitOf(symbol) === "points";
  const kit = useMemo<DrawKit>(
    () =>
      makeKit(
        {
          axis: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.axis }),
          pill: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.pill, fontWeight: "bold" }),
          pillSmall: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.pillSmall, fontWeight: "bold" }),
          tag: matchFont({ fontFamily: MONO, fontSize: FONT_SIZE.tag, fontWeight: "bold" }),
          mark: markFont,
        },
        {
          up: Skia.Color(color.chartUp),
          down: Skia.Color(color.chartDown),
          ink: Skia.Color(color.ink),
          inverse: Skia.Color(color.ground),
          helper: Skia.Color(color.inkMuted),
          onLine: Skia.Color(color.paperInk),
        },
        {
          line: Skia.PathEffect.MakeDash([...LEVEL_DASH.line], 0),
          entry: Skia.PathEffect.MakeDash([...LEVEL_DASH.entry], 0),
          edge: Skia.PathEffect.MakeDash([...LEVEL_DASH.edge], 0),
        },
        {
          solid: Skia.Color(CHART_ERASER.solid),
          mid: Skia.Color(CHART_ERASER.mid),
          clear: Skia.Color(CHART_ERASER.clear),
        },
        MARK,
        points,
      ),
    [color, markFont, points],
  );
  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const state = useSharedValue(createChartState());
  // The newest tick for the UI thread; the first after a (re)start carries the history line and asks for a fresh chart.
  const incoming = useSharedValue<{ seq: number; price: number; line: number[] | null; reset: boolean }>({
    seq: 0,
    price: 0,
    line: null,
    reset: false,
  });
  const overlayValue = overlay;
  const size = useSharedValue({ w: 0, h: 0 });
  const clock = useSharedValue(0);

  // A new market opens on its last ~10 s of real history when the client holds it (04-pricing R15), else flat; on a cold
  // start that history may land just after the first tick, and within the first second the line is redrawn from it.
  useEffect(() => {
    state.modify((s) => {
      "worklet";
      resetChart(s);
      return s;
    });
    let seq = 0;
    let firstAt = 0;
    const history = () => {
      const h = live.prices.history(symbol);
      return fillLine(h.t, h.p, Date.now(), SAMPLE_CAPACITY, SAMPLE_MS)?.map((v) => v / E8) ?? null;
    };
    const push = (reset = false) => {
      const t = live.prices.latest(symbol);
      if (!t) return;
      seq += 1;
      const first = firstAt === 0 || reset;
      if (first) firstAt = Date.now();
      incoming.value = { seq, price: t.priceE8 / E8, line: first ? history() : null, reset };
    };
    push();
    let active = true;
    void live
      .loadHistory(symbol)
      .then(() => {
        if (active && firstAt !== 0 && Date.now() - firstAt <= RESEED_WINDOW_MS) push(true);
      })
      .catch(() => {});
    const off = live.prices.subscribe(symbol, () => push());
    return () => {
      active = false;
      off();
    };
  }, [live, symbol, state, incoming]);

  useFrameCallback((frame) => {
    "worklet";
    const plotW = Math.max(0, size.value.w - PILL_ALLOWANCE);
    state.modify((s) => {
      "worklet";
      const tick = incoming.value;
      if (tick.seq !== s.seenSeq) {
        s.seenSeq = tick.seq;
        if (tick.reset) resetChart(s);
        takePrice(s, tick.price, frame.timestamp, tick.line);
      }
      advance(s, frame.timestamp, reduced, plotW, health?.value.live ?? true);
      if (s.ready) setOdometer(s.price, formatValue(s.latest, priceDecimals(s.latest), points), s.latest);
      const o = overlayValue.value;
      if (o?.pnlText) setOdometerTrend(s.pnl, o.pnlText, o.pnlTrend);
      return s;
    });
    clock.value = frame.timestamp;
  });

  // The dot field is drawn once per size and shifted each frame (one picture instead of ~270 circles).
  const dots = useDerivedValue(() => makeDotPicture(kit, size.value.w, size.value.h));

  const picture = useDerivedValue(() => {
    "worklet";
    const { w, h } = size.value;
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
    const at =
      clock.value > 0 && w > 0
        ? drawFrame(canvas, kit, state.value, overlayValue.value, w, h, waiting, dots.value, health?.value ?? LIVE)
        : null;
    if (head) head.value = at;
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
});

const styles = StyleSheet.create({ fill: { flex: 1 } });
