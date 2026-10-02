import { DECIMALS, ONE_USD6 } from "@senryo/core";
import { useCandles } from "@senryo/query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CandleChart } from "~/components/charts/CandleChart";
import { EmptyState, ReadingView, Skeleton } from "~/components/kit/states";
import { ChartCandlestick, Grid3x3, Info, SlidersHorizontal } from "~/components/kit/symbols";
import { Keypad } from "~/components/trade/Keypad";
import { LeverageRuler } from "~/components/trade/LeverageRuler";
import { Preset } from "~/components/trade/Preset";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { moneySymbol, pct, price18, priceDecimalsOf, usd } from "~/lib/money";
import {
  BUTTON,
  CONTROL_FONT_SCALE,
  HERO_FONT_SCALE,
  RADIUS,
  SIZE,
  SPACE,
  STACK_FONT_SCALE,
  TYPE,
  useTheme,
} from "~/theme";
import { useCandleStyle } from "./candle-style";
import { AMOUNT_CHIPS_USD } from "./constants";
import { usePlannedTriggers } from "./planned-triggers";
import type { useTicket } from "./useTicket";

type TicketModel = ReturnType<typeof useTicket>;
export type EntryMode = "keypad" | "chart";
export type TicketChild = "liquidation" | "tpsl" | "review" | "candles";

const CHART_INTERVAL = 900;
const MS_PER_SECOND = 1000;

/**
 * The ticket's entry body in Fomo's anatomy (F37–F42; flow book C3 step 3): the margin is the dominant number (Inter
 * Display 64/68) with the leveraged-size line above it once there is an amount (F41: $10 at 2× reads "Leveraged size
 * $20" while the margin stays $10); the centred leverage ruler; liquidation price ⓘ and "Add SL/TP";
 * the keypad ↔ chart toggle; then presets + keypad, or the embedded candle chart with its settings — the amount and
 * leverage are kept across the toggle (FT105). Unknown values are placeholders or skeletons, never $0.00. At large
 * text sizes the body scrolls instead of squeezing: keys keep their full touch height and the chart its own.
 */
export function TicketEntry({
  t,
  line,
  mode,
  onMode,
  onChild,
  planKey,
}: {
  t: TicketModel;
  line: MarketLine;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  onChild: (child: TicketChild) => void;
  /** Where SL/TP planned for this order are kept (S1b.8a). */
  planKey: string;
}) {
  const fits = useWindowDimensions().fontScale <= STACK_FONT_SCALE;
  const content = (
    <>
      <Amount t={t} />
      <LeverageRuler value={t.leverage} max={line.maxLeverageX} onChange={t.setLeverage} />
      <RiskRow t={t} line={line} onChild={onChild} planKey={planKey} />
      <ModeToggle mode={mode} onMode={onMode} />
      {mode === "keypad" ? (
        <KeypadRegion t={t} />
      ) : (
        <ChartRegion line={line} onSettings={() => onChild("candles")} fixed={!fits} />
      )}
    </>
  );
  if (fits) return <View style={styles.body}>{content}</View>;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  );
}

function Amount({ t }: { t: TicketModel }) {
  const { color } = useTheme();
  const empty = t.amountText === "";
  return (
    <View style={styles.amount}>
      {/* Above the hero, never in place of it: the margin stays the figure the user typed. */}
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        style={[TYPE.meta, { color: empty ? color.transparent : color.text3 }]}
        numberOfLines={1}
        accessibilityElementsHidden={empty}
      >
        Leveraged size{" "}
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.moneyMeta, { color: color.ink }]}>
          {empty ? "" : usd(t.notionalUsd6)}
        </Text>
      </Text>
      <Text
        maxFontSizeMultiplier={HERO_FONT_SCALE}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[TYPE.displayMargin, { color: empty ? color.text3 : color.ink }]}
        accessibilityLabel={`Margin ${empty ? "not set" : `${t.amountText} dollars`}, leverage ${t.leverage} times`}
      >
        {moneySymbol()}
        {empty ? "0" : t.amountText}
      </Text>
    </View>
  );
}

function RiskRow({
  t,
  line,
  onChild,
  planKey,
}: {
  t: TicketModel;
  line: MarketLine;
  onChild: (c: TicketChild) => void;
  planKey: string;
}) {
  const planned = usePlannedTriggers(planKey).levels;
  const { color } = useTheme();
  const liq = t.preview?.liqPrice18;
  const away = t.preview?.liqDistanceBps;
  const decimals = priceDecimalsOf(line.marketId);
  return (
    <View style={styles.risk}>
      <Pressable
        onPress={() => onChild("liquidation")}
        accessibilityRole="button"
        accessibilityHint="Explains the liquidation price"
        style={styles.riskCell}
      >
        <View style={styles.inline}>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
            Liquidation price
          </Text>
          <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        </View>
        {t.amountText === "" ? (
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.text3 }]}>
            Enter amount
          </Text>
        ) : t.preview === undefined && !t.hasAccount ? (
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.text3 }]}>
            —
          </Text>
        ) : t.preview === undefined ? (
          <Skeleton width={SIZE.sparklineWidth} height={SIZE.skeletonLine} />
        ) : (
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[
              TYPE.rowAmount,
              { color: away !== undefined && away !== null && away < 0n ? color.down : color.ink },
            ]}
          >
            {liq === null || liq === undefined ? "None" : `$${price18(liq, decimals)}`}
            {away === null || away === undefined ? (
              ""
            ) : (
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.moneyMeta, { color: color.text3 }]}>
                {" "}
                · {pct(away < 0n ? -away : away)} {away < 0n ? "past" : "away"}
              </Text>
            )}
          </Text>
        )}
      </Pressable>
      <Pressable onPress={() => onChild("tpsl")} accessibilityRole="button" style={[styles.riskCell, styles.end]}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, styles.right, { color: color.text3 }]}>
          Stop loss / Take profit
        </Text>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[
            TYPE.rowStrong,
            styles.right,
            { color: planned.length > 0 ? color.ink : t.amountText === "" && !t.held ? color.text3 : color.link },
          ]}
        >
          {t.held
            ? "Edit SL/TP"
            : planned.length > 0
              ? planned.map((l) => `${l.kind === "sl" ? "SL" : "TP"} $${price18(l.price18, decimals)}`).join(" · ")
              : "Add SL/TP"}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Keypad ↔ chart (C41): two icons in a small borderless track, the chosen one on a lighter plate (the segmented
 * control's grammar, without F37's divider line); the rest of the ticket stays put.
 */
export function ModeToggle({ mode, onMode }: { mode: EntryMode; onMode: (m: EntryMode) => void }) {
  const { color } = useTheme();
  const option = (m: EntryMode, label: string, Icon: typeof Grid3x3) => {
    const on = m === mode;
    return (
      <Pressable
        onPress={() => {
          if (on) return;
          fire("tick");
          onMode(m);
        }}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        hitSlop={SPACE.sm}
        style={[styles.toggleCell, on ? { backgroundColor: color.rowPressed } : null]}
      >
        <Icon size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={on ? color.ink : color.text3} />
      </Pressable>
    );
  };
  return (
    <View style={styles.toggleRow} accessibilityRole="tablist" accessibilityLabel="Entry mode">
      <View style={[styles.toggle, { backgroundColor: color.muted }]}>
        {option("keypad", "Keypad", Grid3x3)}
        {option("chart", "Chart", ChartCandlestick)}
      </View>
    </View>
  );
}

function KeypadRegion({ t }: { t: TicketModel }) {
  return (
    <View style={styles.region}>
      <View style={styles.presets}>
        {AMOUNT_CHIPS_USD.map((c) => (
          <Preset
            key={String(c)}
            label={`${moneySymbol()}${c}`}
            accessibilityLabel={`Set margin to ${moneySymbol()}${c}`}
            onPress={() => t.setAmountUsd6(c * ONE_USD6)}
          />
        ))}
        <Preset
          label="Max"
          accessibilityLabel="Max: everything Free to trade allows"
          disabled={t.maxAmountUsd6 === 0n}
          onPress={() => t.setAmountUsd6(t.maxAmountUsd6)}
        />
      </View>
      <Keypad onKey={t.onKey} />
    </View>
  );
}

/** The embedded chart (F39): Chainlink candles in the saved style; the gear opens the candle settings child (F40). */
function ChartRegion({ line, onSettings, fixed }: { line: MarketLine; onSettings: () => void; fixed: boolean }) {
  const { color } = useTheme();
  const candles = useCandles(line.symbol, CHART_INTERVAL);
  const style = useCandleStyle();
  const [height, setHeight] = useState(0);
  return (
    <View style={styles.region}>
      <View style={styles.chartBar}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
          15m · Chainlink
        </Text>
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="Candle settings"
          hitSlop={SPACE.sm}
          style={styles.gear}
        >
          <SlidersHorizontal size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
      </View>
      <View style={fixed ? styles.chartFixed : styles.chart} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        <ReadingView reading={candles} loading="chart" loadingLabel="Loading Chainlink rounds">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState why="No rounds in this window yet" />
            ) : height > 0 ? (
              <CandleChart
                decimals={DECIMALS.e18}
                style={style}
                height={height}
                candles={rows.map((c) => ({
                  t: c.openTime * MS_PER_SECOND,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                }))}
              />
            ) : null
          }
        </ReadingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.sm },
  fill: { flex: 1 },
  scrollBody: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.md },
  amount: { alignItems: "center", gap: SPACE.xxs },
  risk: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.md },
  // Each cell may shrink, so at large text a long value wraps instead of running off the sheet.
  riskCell: { flexShrink: 1, gap: SPACE.xxs, minHeight: SIZE.touch, justifyContent: "center" },
  end: { alignItems: "flex-end" },
  right: { textAlign: "right" },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  toggleRow: { flexDirection: "row", justifyContent: "center" },
  toggle: { flexDirection: "row", borderRadius: BUTTON.radius.sm, padding: SPACE.xxs, gap: SPACE.xxs },
  toggleCell: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.xs },
  region: { flex: 1, gap: SPACE.sm },
  presets: { flexDirection: "row", gap: SPACE.sm },
  chartBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gear: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  chart: { flex: 1 },
  chartFixed: { height: SIZE.chartCandles },
});
