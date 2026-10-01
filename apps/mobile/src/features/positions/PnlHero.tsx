import { StyleSheet, Text, View } from "react-native";
import { Panel } from "~/components/kit/Surface";
import { arrow, signedUsd } from "~/lib/money";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The position's result (Fomo F13/F14's P&L card; C25): one filled plate whose dominant figure is the unrealised P&L
 * net of funding and borrow, signed and coloured with its ▲▼ — and under it, as three quiet label-over-value cells,
 * what it is made of: the price move at the conservative exit, funding and borrow owed since the last settle. The
 * parts are separated from the figure by space, not a rule.
 */
export function PnlHero({
  priceUsd6,
  fundingUsd6,
  borrowUsd6,
}: {
  /** Unrealised P&L from the price alone, at the conservative exit. */
  priceUsd6: bigint;
  /** Funding and borrow owed (positive = the position pays). */
  fundingUsd6: bigint;
  borrowUsd6: bigint;
}) {
  const { color } = useTheme();
  const net = priceUsd6 - fundingUsd6 - borrowUsd6;
  const parts = [
    { label: "Price", value: signedUsd(priceUsd6) },
    { label: "Funding", value: signedUsd(-fundingUsd6) },
    { label: "Borrow", value: signedUsd(-borrowUsd6) },
  ] as const;
  return (
    <Panel style={styles.panel}>
      <View style={styles.figure}>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Unrealised · net</Text>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[TYPE.displayPrice, { color: net < 0n ? color.down : color.up }]}
          accessibilityLabel={`Unrealised ${net < 0n ? "loss" : "profit"} ${signedUsd(net)}`}
        >
          {arrow(net)} {signedUsd(net)}
        </Text>
      </View>
      <View style={styles.parts}>
        {parts.map((p) => (
          <View key={p.label} style={styles.part} accessible accessibilityLabel={`${p.label} ${p.value}`}>
            <Text style={[TYPE.meta, { color: color.text3 }]}>{p.label}</Text>
            <Text style={[TYPE.rowChange, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {p.value}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lgPlus, gap: SPACE.lg },
  figure: { gap: SPACE.xs },
  parts: { flexDirection: "row", gap: SPACE.md },
  part: { flex: 1, gap: SPACE.xxs },
});
