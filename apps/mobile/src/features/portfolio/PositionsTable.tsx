import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { positionRoute } from "~/lib/constants/routes";
import { pct, price, signedUsd, usd } from "~/lib/money";
import type { SamplePosition } from "~/lib/sample";
import { HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** D2 positions table: MKT · SIZE · LIQ · PNL; a row opens the position (close, TP/SL, margin in S8). */
export function PositionsTable({ positions }: { positions: SamplePosition[] }) {
  const { color } = useTheme();
  return (
    <Panel>
      <View style={[styles.row, styles.head, { borderBottomColor: color.hairline }]}>
        {["MKT", "SIZE", "LIQ", "PNL"].map((h, i) => (
          <Text key={h} style={[TYPE.label, i === 0 ? styles.first : styles.num, { color: color.inkMuted }]}>
            {h}
          </Text>
        ))}
      </View>
      {positions.map((p, i) => {
        const sideColor = p.side === "long" ? color.up : color.down;
        const pnlColor = p.pnl6 < 0n ? color.down : color.up;
        return (
          <Pressable
            key={p.id}
            onPress={() => {
              fire("tick");
              router.push(positionRoute(p.id));
            }}
            accessibilityRole="button"
            accessibilityLabel={`${p.market} ${p.side}, ${p.leverage} times, profit ${signedUsd(p.pnl6)}, liquidation ${pct(p.liqDistanceBps)} away`}
            style={({ pressed }) => [
              styles.row,
              i > 0 ? { borderTopWidth: HAIRLINE_PX, borderTopColor: color.hairline } : null,
              pressed ? { backgroundColor: color.muted } : null,
            ]}
          >
            <View style={styles.first}>
              <Text style={[TYPE.numMd, { color: color.ink }]}>{p.market}-PERP</Text>
              <Text style={[TYPE.numSm, { color: sideColor }]}>
                {p.side.toUpperCase()} {p.leverage}x
              </Text>
            </View>
            <Text style={[TYPE.numSm, styles.num, { color: color.ink }]}>{usd(p.size6, 0)}</Text>
            <Text style={[TYPE.numSm, styles.num, { color: color.inkMuted }]}>{price(p.liqE8, 1)}</Text>
            <Text style={[TYPE.numSm, styles.num, { color: pnlColor }]}>{signedUsd(p.pnl6)}</Text>
          </Pressable>
        );
      })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.md, minHeight: SIZE.touch + SPACE.lg },
  head: { minHeight: SIZE.touch, borderBottomWidth: HAIRLINE_PX },
  first: { flex: 1.4, gap: SPACE.xxs },
  num: { flex: 1, textAlign: "right" },
});
