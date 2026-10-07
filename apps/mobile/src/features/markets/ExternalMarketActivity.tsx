import { ids } from "@senryo/identity";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { marketRoute } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import {
  ACTIVITY_PAIRS,
  type ActivitySymbol,
  type ExternalTrade,
  fetchExternalTrades,
  hasActivityPair,
  MAX_AGE_MS,
} from "./external-activity";
import { ageLabel } from "./session";
import { useNowSec } from "./useNowSec";

const REFRESH_MS = 15_000;
const GLOBAL_SYMBOLS = ["BTC", "ETH", "XAU"] as const;
const MAX_ROWS = 6;
const MS_PER_SECOND = 1000;

/** Real external spot executions; no wallet identity, Senryo fill, or oracle price is inferred. */
export function ExternalMarketActivity({ symbol }: { symbol?: string }) {
  const { color } = useTheme();
  const now = useNowSec();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const symbols: readonly ActivitySymbol[] = symbol ? (hasActivityPair(symbol) ? [symbol] : []) : GLOBAL_SYMBOLS;
  const note =
    symbol && hasActivityPair(symbol) && "note" in ACTIVITY_PAIRS[symbol] ? ACTIVITY_PAIRS[symbol].note : undefined;
  const query = useQuery({
    queryKey: ["external-market-activity", ...symbols],
    queryFn: async ({ signal }) => {
      const settled = await Promise.allSettled(symbols.map((item) => fetchExternalTrades(item, signal)));
      const valid = settled.flatMap((result) =>
        result.status === "fulfilled" ? result.value.slice(0, symbol ? MAX_ROWS : 2) : [],
      );
      if (settled.every((result) => result.status === "rejected")) throw new Error("Market activity is unavailable");
      return valid.sort((a, b) => b.at - a.at).slice(0, MAX_ROWS);
    },
    enabled: focused && symbols.length > 0,
    staleTime: REFRESH_MS,
    refetchInterval: focused ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });
  const visible = query.data?.filter((trade) => trade.at >= Number(now) * MS_PER_SECOND - MAX_AGE_MS);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Market activity
      </Text>
      <View style={styles.source}>
        <EntityMark id={ids.exchange("binance")} size={SIZE.markInline} decorative ground={color.ground} />
        <Text style={[TYPE.meta, { color: color.text3 }]}>
          Recent Binance spot trades · separate from Senryo positions
        </Text>
      </View>
      {symbol && !hasActivityPair(symbol) ? (
        <Text style={[TYPE.body, { color: color.text3 }]}>No verified outside trade source for {symbol} yet.</Text>
      ) : visible && visible.length > 0 ? (
        <View>
          {query.isError ? (
            <Text style={[TYPE.meta, { color: color.warn }]}>Source refresh failed · showing last verified trades</Text>
          ) : null}
          {visible.map((trade) => (
            <ActivityRow key={trade.id} trade={trade} now={now} />
          ))}
        </View>
      ) : (
        <Pressable onPress={() => void query.refetch()} accessibilityRole="button">
          <Text style={[TYPE.body, { color: color.text3 }]}>
            {query.isPending
              ? "Reading recent trades…"
              : query.isError
                ? "Market activity unavailable · Tap to retry"
                : "No recent spot trades from this source"}
          </Text>
        </Pressable>
      )}
      {typeof note === "string" ? <Text style={[TYPE.meta, { color: color.text3 }]}>{note}</Text> : null}
    </View>
  );
}

function ActivityRow({ trade, now }: { trade: ExternalTrade; now: bigint }) {
  const { color } = useTheme();
  const pair = ACTIVITY_PAIRS[trade.symbol];
  const quantity = trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const notional = trade.notional.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const side = trade.side === "buy" ? "Bought" : "Sold";
  const age = ageLabel(BigInt(Math.floor(trade.at / MS_PER_SECOND)), now);
  return (
    <Pressable
      onPress={() => router.push(marketRoute(trade.symbol))}
      accessibilityRole="button"
      accessibilityLabel={`${side} ${quantity} ${pair.base} on Binance ${pair.label}, about ${notional} USDT, ${age}`}
      style={styles.row}
    >
      <View style={styles.rowTop}>
        <Text style={[TYPE.rowStrong, { color: trade.side === "buy" ? color.up : color.down }]}>{side}</Text>
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>
          {quantity} {pair.base}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{age}</Text>
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
        {pair.label} on Binance · ≈{notional} USDT
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.sm },
  source: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  row: { paddingVertical: SPACE.sm, gap: SPACE.xxs },
  rowTop: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: SPACE.sm },
});
