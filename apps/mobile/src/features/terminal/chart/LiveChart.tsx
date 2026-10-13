/**
 * The terminal's live chart (S5, D-272 budgets): ticks from `@senryo/live` land in a shared value; a frame callback on
 * the UI thread eases, samples and rolls the digits; a picture is re-recorded each frame from that state. React renders
 * only on layout and when the market changes — never per tick (the overlay is a shared value too). `candles` turns on
 * the candle view (R5.17): closed candles from our one-minute archive, re-read after each boundary, the forming one from
 * live ticks; drag pans back (older candles load as it nears them), pinch zooms, double-tap recentres, a tap shows a
 * crosshair that a drag then moves — each detent a haptic tick.
 */
import { candlesRoute } from "@senryo/api-client";
import {
  type CandleInterval,
  candleMerge,
  groupCandles,
  INTERVAL_SEC,
  LEVEL_STYLE,
  type LevelKind,
  newCandles,
  unitOf,
} from "@senryo/calls";
import { fillLine } from "@senryo/live";
import { useLive, useLiveStream } from "@senryo/live/react";
import { useQueryEnv } from "@senryo/query";
import { Canvas, matchFont, Picture, Skia, useFont } from "@shopify/react-native-skia";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { type LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { setOdometer, setOdometerTrend } from "~/components/kit/odometer";
import { fire } from "~/feedback/fire";
import { useTheme } from "~/theme";
import { CHART_ERASER } from "~/theme/palette";
import { panCandles, recentreCandles, zoomCandles } from "./candle-state";
import { type ChartHealth, type ChartHistory, LIVE, RESEED_WINDOW_MS } from "./constants";
import { type ChartOverlay, drawFrame, type Head } from "./draw";
import { formatValue, priceDecimals, SAMPLE_CAPACITY, SAMPLE_MS } from "./engine";
import { type DrawKit, makeDotPicture, makeKit } from "./kit";
import { advance, createChartState, loadHistory, resetChart, takePrice } from "./state";

const E8 = 1e8;
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const FONT_SIZE = { axis: 11, pill: 13, pillSmall: 11, tag: 10 } as const;
const MARK_FONT_SIZE = 96;
const MARK = "千両";
/** The dot field moves with the plot, which ends before the pill; this estimate only paces the dots. */
const PILL_ALLOWANCE = 110;
const MS = 1_000;
const CLOCK_SYNC_MS = 5_000;
/** Candles shown on arrival, and the last few re-read just after each boundary (the archive's minute settles). */
const CANDLES_LOADED = 120;
const CANDLES_REREAD = 3;
const REREAD_AFTER_MS = 4_000;
/**
 * A drag takes over past this many points either way (the terminal doesn't scroll): with a crosshair up it moves it,
 * else its horizontal part scrolls history. A tap is a finger that stays within it.
 */
const PAN_ACTIVE = 10;

const tick = () => fire("tick");

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
  /** A closed market's last session (null while it trades): drawn whole and still on its own scale. */
  history?: SharedValue<ChartHistory | null>;
  /** The candle view's interval, or null for the line (R5.17). */
  candles?: CandleInterval | null;
}

/** Memoised: its props are stable, so the terminal's once-a-second countdown render never reaches the chart. */
export const LiveChart = memo(function LiveChart({
  symbol,
  overlay,
  waiting,
  head,
  health,
  history,
  candles = null,
}: LiveChartProps) {
  const live = useLive();
  // The api client is stable; the env object around it is not.
  const api = useQueryEnv().api;
  const clockOffset = useSharedValue(live.clock.offset);
  const lastDetent = useSharedValue<string | null>(null);
  // Out of focus (a dock tab mounted ahead of its visit, R5.24, or left behind) the frame loop rests. It starts at rest:
  // a warmed tab hears no focus event until it is shown, and the focus effect runs on mount for a tab already in front.
  const focused = useSharedValue(false);
  useFocusEffect(
    useCallback(() => {
      focused.value = true;
      return () => {
        focused.value = false;
      };
    }, [focused]),
  );
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
          range: Skia.Color(color.range),
          ink: Skia.Color(color.ink),
          inverse: Skia.Color(color.ground),
          helper: Skia.Color(color.inkMuted),
          warn: Skia.Color(color.warn),
          // The pill's text on the direction ink: white in light, black in dark (the web's `--up-foreground`).
          onLine: Skia.Color(color.upForeground),
        },
        Object.fromEntries(
          (Object.keys(LEVEL_STYLE) as LevelKind[]).map((kind) => [
            kind,
            Skia.PathEffect.MakeDash([...LEVEL_STYLE[kind].dash], 0),
          ]),
        ) as DrawKit["dash"],
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
    if (!focused.value) return;
    const plotW = Math.max(0, size.value.w - PILL_ALLOWANCE);
    state.modify((s) => {
      "worklet";
      const past = history?.value ?? null;
      if (past && past.seq !== s.historySeq) loadHistory(s, past);
      else if (!past && s.historySeq !== 0) resetChart(s);
      const tick = incoming.value;
      if (tick.seq !== s.seenSeq) {
        s.seenSeq = tick.seq;
        if (tick.reset) resetChart(s);
        takePrice(s, tick.price, frame.timestamp, tick.line);
      }
      advance(s, frame.timestamp, reduced, plotW, health?.value.live ?? true, Date.now() + clockOffset.value);
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
    const detent = at?.detent ?? null;
    if (detent !== lastDetent.value) {
      lastDetent.value = detent;
      if (detent) runOnJS(tick)();
    }
    return recorder.finishRecordingAsPicture();
  });

  const olderRef = useRef<(oldestT: number) => void>(() => undefined);
  const older = (oldestT: number) => olderRef.current(oldestT);
  // The candle view: its series loaded from the archive and re-read at each boundary; back to the line when off.
  useEffect(() => {
    const sync = setInterval(() => {
      clockOffset.value = live.clock.offset;
    }, CLOCK_SYNC_MS);
    if (!candles) {
      state.modify((s) => {
        "worklet";
        s.candles.wantMs = 0;
        return s;
      });
      return () => clearInterval(sync);
    }
    const intervalSec = INTERVAL_SEC[candles];
    const intervalMs = intervalSec * MS;
    const now = () => Date.now() + live.clock.offset;
    state.modify((s) => {
      "worklet";
      const v = s.candles;
      v.wantMs = intervalMs;
      v.data = newCandles(intervalMs);
      v.offset = 0;
      v.spacing = 0;
      v.cross = null;
      v.olderAsked = 0;
      return s;
    });
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (count: number, endSec = Math.floor(now() / MS)) => {
      const r = await api
        .call(candlesRoute, { query: { symbol, from: endSec - count * intervalSec, to: endSec } })
        .catch(() => null);
      if (!active || !r) return;
      const rows = groupCandles(r.candles, intervalSec);
      const at = now();
      state.modify((s) => {
        "worklet";
        if (s.candles.data?.intervalMs === intervalMs) candleMerge(s.candles.data, rows, at);
        return s;
      });
    };
    const arm = () => {
      const next = (Math.floor(now() / intervalMs) + 1) * intervalMs + REREAD_AFTER_MS;
      timer = setTimeout(() => void load(CANDLES_REREAD).then(arm), next - now());
    };
    void load(CANDLES_LOADED).then(arm);
    olderRef.current = (oldestT: number) => void load(CANDLES_LOADED, Math.floor(oldestT / MS));
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(sync);
    };
  }, [candles, symbol, api, live, state, clockOffset]);

  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-PAN_ACTIVE, PAN_ACTIVE])
      .activeOffsetY([-PAN_ACTIVE, PAN_ACTIVE])
      .onChange((e) => {
        "worklet";
        let due: number | null = null;
        state.modify((s) => {
          "worklet";
          const v = s.candles;
          if (!v.data || v.wantMs === 0) return s;
          // With a crosshair up, a drag moves it; without one, it scrolls through history.
          if (v.cross) v.cross = { x: e.x, y: e.y };
          else due = panCandles(v, e.changeX);
          return s;
        });
        if (due !== null) runOnJS(older)(due);
      });
    const pinch = Gesture.Pinch().onChange((e) => {
      "worklet";
      state.modify((s) => {
        "worklet";
        if (s.candles.data) zoomCandles(s.candles, e.scaleChange);
        return s;
      });
    });
    const tap = Gesture.Tap()
      .maxDistance(PAN_ACTIVE)
      .onEnd((e) => {
        "worklet";
        state.modify((s) => {
          "worklet";
          const v = s.candles;
          if (v.data && v.wantMs > 0) v.cross = v.cross ? null : { x: e.x, y: e.y };
          return s;
        });
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(PAN_ACTIVE)
      .onEnd(() => {
        "worklet";
        state.modify((s) => {
          "worklet";
          s.candles.cross = null;
          recentreCandles(s.candles);
          return s;
        });
      });
    // Taps wait for the pinch to fail: a symmetric pinch keeps its centroid still, so a distance check alone lets
    // two fingers count as a tap.
    return Gesture.Simultaneous(pan, Gesture.Exclusive(pinch, doubleTap, tap));
  }, [state]);

  const onLayout = (e: LayoutChangeEvent) => {
    size.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <GestureDetector gesture={gestures}>
      <View style={styles.fill} onLayout={onLayout} accessible accessibilityLabel={`${symbol} live price chart`}>
        <Canvas style={styles.fill}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({ fill: { flex: 1 } });
