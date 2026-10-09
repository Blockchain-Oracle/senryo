/**
 * Markets (S5.10): every market on this network with its real mark, name, live price and the 1-minute window's
 * countdown; tapping one opens the terminal there. Prices render at most once a frame (lists, not the terminal).
 */
import { CADENCES_SEC, LOCKOUT_SEC } from "@senryo/config";
import { clockText, laneLabel, windowCountdown } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice, useServerSeconds } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { EntityMark } from "~/components/identity/EntityMark";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatUsd } from "../terminal/chart/engine";

const MARK = 40;
const E8 = 1e8;
const FIRST_CADENCE = CADENCES_SEC[0];

export function MarketRow({ symbol, name, onOpen }: { symbol: string; name: string; onOpen: () => void }) {
  const { color } = useTheme();
  const price = useLivePrice(symbol);
  const now = useServerSeconds();
  const { open, closesIn, endsIn: reopensIn } = windowCountdown(now, FIRST_CADENCE, LOCKOUT_SEC);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}${price ? `, ${formatUsd(price / E8)}` : ""}. Open the terminal`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.rowPressed }]}
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{symbol}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {name} · {laneLabel(FIRST_CADENCE)}{" "}
          {open ? `closes in ${clockText(closesIn)}` : `calls reopen in ${clockText(reopensIn)}`}
        </Text>
      </View>
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>{price ? formatUsd(price / E8) : "—"}</Text>
    </Pressable>
  );
}

export function MarketsScreen() {
  const catalog = useCatalog();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const open = (symbol: string) => {
    fire("tick");
    setSymbol(symbol);
    router.navigate("/trade");
  };
  return (
    <CollapsingScreen left={<TabTitle>Markets</TabTitle>}>
      {catalog.status === "unknown" ? (
        <LoadingState />
      ) : !("value" in catalog) ? (
        <EmptyState why="Markets are unavailable" detail="Pull to try again." />
      ) : (
        <View>
          {catalog.value.markets.map((m) => (
            <MarketRow key={m.symbol} symbol={m.symbol} name={m.name} onOpen={() => open(m.symbol)} />
          ))}
        </View>
      )}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.xl },
  text: { flex: 1 },
});
