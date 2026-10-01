import type { PositionView } from "@senryo/chain";
import { DECIMALS, formatUnits, type PositionHealth } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarginGauge } from "~/components/trade/MarginGauge";
import { pct, price18, priceDecimalsOf, usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";

const SIZE_DECIMALS = 4;

/**
 * The position's facts as a grid of quiet label-over-value cells, bare on the page (Fomo F13's "Invested / Avg.
 * entry" pairs; not a table): size, exposure at the oracle price, entry, oracle, the liquidation price with how far
 * away it is, and margin use with its thin meter. Two columns, so a seven-decimal FX price still fits its cell.
 */
export function PositionStats({
  market,
  position,
  health,
  exposureUsd6,
}: {
  market: LiveMarket;
  position: PositionView;
  health: PositionHealth;
  exposureUsd6: bigint;
}) {
  const { color } = useTheme();
  const decimals = priceDecimalsOf(market.marketId);
  const away = health.liqDistanceBps;
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Stat label="Size" value={`${formatUnits(position.size, DECIMALS.e18, SIZE_DECIMALS)} oz`} />
        <Stat label="Exposure" value={usd(exposureUsd6)} />
      </View>
      <View style={styles.row}>
        <Stat label="Entry" value={price18(position.entry, decimals)} />
        <Stat label="Oracle" value={price18(market.pv.price18, decimals)} />
      </View>
      <View style={styles.row}>
        <Stat
          label="Liquidation"
          value={
            health.liqPrice18 === null
              ? "none above $0"
              : `${price18(health.liqPrice18, decimals)}${away === null ? "" : ` · ${away <= 0n ? "now" : `${pct(away)} away`}`}`
          }
          valueColor={away !== null && away <= 0n ? color.down : undefined}
        />
        <Cell>
          <MarginGauge usageBps={health.marginUsageBps} label="Margin use" />
        </Cell>
      </View>
    </View>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <View style={styles.cell}>{children}</View>;
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string | undefined }) {
  const { color } = useTheme();
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${label} ${value}`}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        style={[TYPE.rowAmount, { color: valueColor ?? color.ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACE.lgPlus },
  row: { flexDirection: "row", gap: SPACE.lg },
  cell: { flex: 1, gap: SPACE.xxs },
});
