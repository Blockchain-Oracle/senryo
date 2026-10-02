import { ONE_USD6 } from "@senryo/core";
import { useDiscoveryCandles } from "@senryo/query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CandleChart } from "~/components/charts/CandleChart";
import { EmptyState, ReadingView, Skeleton } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { Keypad } from "~/components/trade/Keypad";
import { LeverageRuler } from "~/components/trade/LeverageRuler";
import { Preset } from "~/components/trade/Preset";
import { useCandleStyle } from "~/features/trade/candle-style";
import { AMOUNT_CHIPS_USD } from "~/features/trade/constants";
import { type EntryMode, ModeToggle } from "~/features/trade/Ticket";
import { pct } from "~/lib/money";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, STACK_FONT_SCALE, TYPE, useTheme } from "~/theme";
import { liqDistanceBps, perplPrice, perplUsd } from "./format";
import { perplWatchKey } from "./market";
import type { PerplTicketModel } from "./usePerplTicket";

const CHART_INTERVAL = 900;
const MS_PER_SECOND = 1000;
const E18 = 18;
/** A ruler needs a range: while the market's maximum is read the ruler shows 1…the draft's leverage. */
const RULER_FALLBACK_MAX = 5;

/**
 * The Perpl ticket's entry body, in the engine ticket's anatomy (F37–F42): the margin as the one hero with the
 * leveraged size above it, the leverage ruler from 1× to Perpl's maximum for this market (read live), the liquidation
 * estimate from Perpl's own formula (ⓘ explains it; nothing is shown when it can't be computed) beside "TP/SL · On Perpl
 * soon", the keypad ↔ chart switch, then presets + keypad or Perpl's own candles. Amounts are real dollars.
 */
export function PerplTicketEntry({
  t,
  mode,
  onMode,
  onLiquidation,
}: {
  t: PerplTicketModel;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  onLiquidation: () => void;
}) {
  const fits = useWindowDimensions().fontScale <= STACK_FONT_SCALE;
  const content = (
    <>
      <Amount t={t} />
      <LeverageRuler
        value={t.leverage}
        max={t.maxX ?? Math.max(t.leverage, RULER_FALLBACK_MAX)}
        onChange={t.setLeverage}
      />
      <RiskRow t={t} onLiquidation={onLiquidation} />
      <ModeToggle mode={mode} onMode={onMode} />
      {mode === "keypad" ? <KeypadRegion t={t} /> : <ChartRegion t={t} fixed={!fits} />}
    </>
  );
  if (fits) return <View style={styles.body}>{content}</View>;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  );
}

function Amount({ t }: { t: PerplTicketModel }) {
  const { color } = useTheme();
  const empty = t.amountText === "";
  return (
    <View style={styles.amount}>
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        style={[TYPE.meta, { color: empty ? color.transparent : color.text3 }]}
        numberOfLines={1}
        accessibilityElementsHidden={empty}
      >
        Leveraged size{" "}
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.moneyMeta, { color: color.ink }]}>
          {empty ? "" : perplUsd(t.notionalUsd6)}
        </Text>
      </Text>
      <Text
        maxFontSizeMultiplier={HERO_FONT_SCALE}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[TYPE.displayMargin, { color: empty ? color.text3 : color.ink }]}
        accessibilityLabel={`Margin ${empty ? "not set" : `${t.amountText} dollars`}, leverage ${t.leverage} times`}
      >
        ${empty ? "0" : t.amountText}
      </Text>
    </View>
  );
}

function RiskRow({ t, onLiquidation }: { t: PerplTicketModel; onLiquidation: () => void }) {
  const { color } = useTheme();
  const away = t.terms ? liqDistanceBps(t.terms.markPNS, t.liqPricePNS, t.side) : null;
  return (
    <View style={styles.risk}>
      <Pressable
        onPress={onLiquidation}
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
        ) : !t.terms ? (
          <Skeleton width={SIZE.sparklineWidth} height={SIZE.skeletonLine} />
        ) : t.lots === 0n ? (
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.text3 }]}>
            —
          </Text>
        ) : (
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowAmount, { color: color.ink }]}>
            {t.liqPricePNS === null ? "None" : `~${perplPrice(t.liqPricePNS, t.meta)}`}
            {away === null ? (
              ""
            ) : (
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.moneyMeta, { color: color.text3 }]}>
                {" "}
                · {pct(away < 0n ? -away : away)} away
              </Text>
            )}
          </Text>
        )}
      </Pressable>
      <View
        style={[styles.riskCell, styles.end]}
        accessible
        accessibilityLabel="Stop loss and take profit on Perpl soon"
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, styles.right, { color: color.text3 }]}>
          Stop loss / Take profit
        </Text>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, styles.right, { color: color.text3 }]}>
          On Perpl soon
        </Text>
      </View>
    </View>
  );
}

function KeypadRegion({ t }: { t: PerplTicketModel }) {
  return (
    <View style={styles.region}>
      <View style={styles.presets}>
        {AMOUNT_CHIPS_USD.map((c) => (
          <Preset
            key={String(c)}
            label={`$${c}`}
            accessibilityLabel={`Set margin to $${c}`}
            onPress={() => t.setAmountUsd6(c * ONE_USD6)}
          />
        ))}
        <Preset
          label="Max"
          accessibilityLabel="Max: what's on Perpl plus your wallet's AUSD"
          disabled={t.maxAmountUsd6 === 0n}
          onPress={() => t.setAmountUsd6(t.maxAmountUsd6)}
        />
      </View>
      <Keypad onKey={t.onKey} />
    </View>
  );
}

/** Perpl's own 15-minute trade candles (the market's candles API), in the saved candle style. */
function ChartRegion({ t, fixed }: { t: PerplTicketModel; fixed: boolean }) {
  const { color } = useTheme();
  const candles = useDiscoveryCandles(perplWatchKey(t.meta.symbol), CHART_INTERVAL);
  const style = useCandleStyle();
  const [height, setHeight] = useState(0);
  return (
    <View style={styles.region}>
      <View style={styles.chartBar}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
          15m · Perpl
        </Text>
      </View>
      <View style={fixed ? styles.chartFixed : styles.chart} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        <ReadingView reading={candles} loading="chart" loadingLabel="Loading Perpl candles">
          {(history) =>
            history.kind === "none" || history.candles.length === 0 ? (
              <EmptyState why={history.kind === "none" ? history.reason : "No trades in this window yet"} />
            ) : height > 0 ? (
              <CandleChart
                decimals={E18}
                style={style}
                height={height}
                candles={history.candles.map((c) => ({
                  t: c.t * MS_PER_SECOND,
                  open: c.o,
                  high: c.h,
                  low: c.l,
                  close: c.c,
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
  riskCell: { flexShrink: 1, gap: SPACE.xxs, minHeight: SIZE.touch, justifyContent: "center" },
  end: { alignItems: "flex-end" },
  right: { textAlign: "right" },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  region: { flex: 1, gap: SPACE.sm },
  presets: { flexDirection: "row", gap: SPACE.sm },
  chartBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: SIZE.touch },
  chart: { flex: 1 },
  chartFixed: { height: SIZE.chartCandles },
});
