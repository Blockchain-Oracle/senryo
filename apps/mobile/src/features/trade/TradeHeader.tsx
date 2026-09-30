import { StyleSheet, Text, View } from "react-native";
import { arrow, price, signedPct, usd } from "~/lib/money";
import type { SampleMarket } from "~/lib/sample";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";

const MARKET_SESSION = { open: "OPEN", closed: "CLOSED", soon: "SOON" } as const;

/** Market header (D2): symbol, oracle price and change; OI and session on the right. Oracle age lands in S8 (D-020). */
export function TradeHeader({ market }: { market: SampleMarket }) {
  const { color } = useTheme();
  const up = market.change24hBps >= 0n;
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[TYPE.numMd, { color: color.ink }]}>
          {market.id}-PERP <Text style={[TYPE.label, { color: color.inkMuted }]}>{market.name} / USD</Text>
        </Text>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          style={[TYPE.numLg, { color: color.ink }]}
          accessibilityLabel={`Oracle price ${price(market.priceE8)}`}
        >
          {price(market.priceE8)}
        </Text>
        <Text style={[TYPE.numSm, { color: up ? color.up : color.down }]}>
          {arrow(market.change24hBps)} {signedPct(market.change24hBps)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>
          OI <Text style={{ color: color.ink }}>{usd(market.openInterest6, 0)}</Text>
        </Text>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>
          SESSION{" "}
          <Text style={{ color: market.status === "open" ? color.up : color.warn }}>
            {MARKET_SESSION[market.status]}
          </Text>
        </Text>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>ORACLE · CHAINLINK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  left: { gap: SPACE.xs, flexShrink: 1 },
  right: { alignItems: "flex-end", gap: SPACE.xs },
});
