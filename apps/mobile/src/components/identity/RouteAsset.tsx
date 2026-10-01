import { ROUTE_CHAIN_ID, type RouteChain, routeAssetId } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EntityMark } from "./EntityMark";

/** Display network names a route quote uses → the registry's route networks. */
const ROUTE_CHAIN_BY_NAME: Readonly<Record<string, RouteChain>> = {
  Monad: "monad",
  Base: "base",
  Ethereum: "ethereum",
  Arbitrum: "arbitrum",
  Solana: "solana",
  Bitcoin: "bitcoin",
};

/**
 * One end of a funding route: the asset's mark with its network as a separate badge, and the text "USDC · on Base".
 * Asset and network stay distinct identities (study 08); an unkeyed pair shows the labelled fallback, never a guess.
 */
export function RouteAsset({ symbol, chain }: { symbol: string; chain: string }) {
  const { color } = useTheme();
  const key = ROUTE_CHAIN_BY_NAME[chain];
  const asset = key === undefined ? undefined : routeAssetId(symbol, key);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${symbol} on ${chain}`}>
      <EntityMark
        id={asset}
        label={symbol}
        size={SIZE.markRow}
        badge={key === undefined ? undefined : ROUTE_CHAIN_ID[key]}
        decorative
      />
      <View style={styles.text}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{symbol}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>on {chain}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  text: { gap: SPACE.xxs },
});
