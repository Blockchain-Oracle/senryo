import type { AccountSnapshot, PositionView } from "@senryo/chain";
import { ENGINE_MARKETS } from "@senryo/config";
import { notional, previewPosition } from "@senryo/core";
import { ids } from "@senryo/identity";
import { riskViewOf, useMarket } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { positionRoute } from "~/lib/constants/routes";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const LIQ_DECIMALS = 1;
const HEADS = ["Market", "Size", "Liq.", "P&L"] as const;

/**
 * The positions table — Market · Size · Liq. · P&L — in one borderless filled group: a quiet header line, then rows
 * separated by their own height (no dividers). Each row prices itself from its market's live oracle view through the
 * core preview (PnL at the conservative exit, liquidation price with the account's other positions held fixed).
 */
export function PositionsTable({ positions, account }: { positions: PositionView[]; account: AccountSnapshot }) {
  const { color } = useTheme();
  return (
    <Panel>
      <View style={[styles.row, styles.head]}>
        {HEADS.map((h, i) => (
          <Text key={h} style={[TYPE.meta, i === 0 ? styles.first : styles.num, { color: color.text3 }]}>
            {h}
          </Text>
        ))}
      </View>
      {positions.map((p) => (
        <PositionRow key={p.marketId} position={p} account={account} />
      ))}
    </Panel>
  );
}

function PositionRow({ position, account }: { position: PositionView; account: AccountSnapshot }) {
  const network = useNetwork();
  const { color } = useTheme();
  const market = useMarket(position.marketId);
  const symbol = ENGINE_MARKETS.find((m) => m.id === position.marketId)?.symbol ?? `#${position.marketId}`;
  const sideColor = position.isLong ? color.up : color.down;
  const side = position.isLong ? "Long" : "Short";
  const mark = <EntityMark id={ids.engineMarket(network.chainId, position.marketId)} size={SIZE.markCell} decorative />;
  if (market.status === "unknown" || market.status === "failed") {
    return (
      <View style={styles.row}>
        <View style={[styles.first, styles.market]}>
          {mark}
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{symbol}-PERP</Text>
        </View>
        <Skeleton width="45%" />
      </View>
    );
  }
  const m = market.value;
  const health = previewPosition(m.risk, m.pv, riskViewOf(account), position);
  const size = notional(position.size, m.pv.price18);
  const away = health.liqDistanceBps;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(positionRoute(String(position.marketId)));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${m.name} ${side.toLowerCase()}, size ${usd(size, 0)}, ${health.upnlUsd6 < 0n ? "loss" : "profit"} ${signedUsd(health.upnlUsd6)}${away === null ? "" : `, liquidation ${pct(away < 0n ? 0n : away)} away`}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.rowPressed } : null]}
    >
      <View style={[styles.first, styles.market]}>
        {mark}
        <View style={styles.marketText}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
            {symbol}-PERP
          </Text>
          <Text style={[TYPE.rowChange, { color: sideColor }]}>{side}</Text>
        </View>
      </View>
      <Text style={[TYPE.rowChange, styles.num, { color: color.ink }]}>{usd(size, 0)}</Text>
      <Text style={[TYPE.rowChange, styles.num, { color: away !== null && away < 0n ? color.down : color.text3 }]}>
        {health.liqPrice18 === null
          ? "—"
          : price18(health.liqPrice18, Math.max(LIQ_DECIMALS, priceDecimalsOf(position.marketId) - 1))}
      </Text>
      <Text style={[TYPE.rowChange, styles.num, { color: health.upnlUsd6 < 0n ? color.down : color.up }]}>
        {signedUsd(health.upnlUsd6)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, minHeight: SIZE.rowMinHeight },
  head: { minHeight: SIZE.touch },
  first: { flex: 1.4, gap: SPACE.xxs },
  market: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  marketText: { gap: SPACE.xxs, flexShrink: 1 },
  num: { flex: 1, textAlign: "right" },
});
