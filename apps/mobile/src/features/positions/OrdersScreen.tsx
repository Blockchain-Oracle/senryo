/**
 * Orders (flow book C8; plan §0.9 Order status / Position): Active · History. Active lists every live TP/SL with its
 * market, the position it closes and when it expires; a tap opens the position, where the level is edited or removed.
 * History keeps the fate of every past level — Filled, Cancelled, Expired (placed past its expiry: the indexer has no
 * such status), or Ended with position (still placed onchain but its position is gone; Remove cancels it). Reached
 * from the position's TP/SL row and from Activity.
 */
import type { PositionView } from "@senryo/chain";
import { engineMarket } from "@senryo/config";
import type { TriggerHistory } from "@senryo/indexer-client";
import { usePositions, useTriggerHistory } from "@senryo/query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { useAccountRetry } from "~/features/portfolio/account";
import { engineMarketIndex } from "~/features/portfolio/market-id";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { marketRoute, positionRoute, ROUTES } from "~/lib/constants/routes";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { OrderRow } from "./OrderRow";
import { useCancelOrder } from "./useCancelOrder";

const TABS = [
  { value: "active", label: "Active" },
  { value: "history", label: "History" },
] as const;
type Tab = (typeof TABS)[number]["value"];
type Fate = "active" | "filled" | "cancelled" | "expired" | "ended";
type Level = TriggerHistory[number];

const MS_PER_SECOND = 1000;
const FATE_WORD: Record<Exclude<Fate, "active">, string> = {
  filled: "Filled",
  cancelled: "Cancelled",
  expired: "Expired",
  ended: "Ended with position",
};

const day = (sec: number) =>
  new Date(sec * MS_PER_SECOND).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function fateOf(level: Level, held: readonly PositionView[], nowSec: number): Fate {
  if (level.status === "EXECUTED") return "filled";
  if (level.status === "CANCELLED") return "cancelled";
  if (level.expiry <= nowSec) return "expired";
  const engine = engineMarketIndex(level.market_id);
  return engine !== undefined && held.some((p) => p.marketId === engine) ? "active" : "ended";
}

export function OrdersScreen() {
  const address = useAccount().hint?.address;
  const history = useTriggerHistory(address);
  const positions = usePositions(address);
  const retry = useAccountRetry();
  const orders = useCancelOrder();
  const [tab, setTab] = useState<Tab>("active");
  const held = positions.status === "fresh" || positions.status === "stale" ? positions.value : [];
  const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
  return (
    <Screen contentStyle={styles.body}>
      <Stack.Screen options={{ title: "Orders" }} />
      {!address ? (
        <QuietLine action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}>
          No orders yet
        </QuietLine>
      ) : (
        <>
          <UnderlineTabs options={TABS} value={tab} onChange={setTab} label="Orders" />
          {history.status === "unknown" ? (
            <PositionRowsSkeleton />
          ) : (
            <ReadingView reading={history} retry={retry}>
              {(levels) => {
                const sorted = levels
                  .map((level) => ({ level, fate: fateOf(level, held, nowSec) }))
                  .filter(({ level }) => !orders.cancelled.has(level.id));
                const shown = sorted.filter(({ fate }) => (tab === "active" ? fate === "active" : fate !== "active"));
                if (shown.length === 0) {
                  return tab === "active" ? (
                    <QuietLine action={{ label: "Browse markets", onPress: () => router.navigate(ROUTES.markets) }}>
                      No open orders
                    </QuietLine>
                  ) : (
                    <QuietLine>No past orders</QuietLine>
                  );
                }
                return (
                  <View>
                    {shown.map(({ level, fate }, i) => (
                      <LevelRow
                        key={level.id}
                        level={level}
                        fate={fate}
                        position={held.find((p) => p.marketId === engineMarketIndex(level.market_id))}
                        index={i}
                        orders={orders}
                      />
                    ))}
                  </View>
                );
              }}
            </ReadingView>
          )}
        </>
      )}
    </Screen>
  );
}

function LevelRow({
  level,
  fate,
  position,
  index,
  orders,
}: {
  level: Level;
  fate: Fate;
  position: PositionView | undefined;
  index: number;
  orders: ReturnType<typeof useCancelOrder>;
}) {
  const { color } = useTheme();
  const engine = engineMarketIndex(level.market_id);
  const symbol = engine === undefined ? level.market_id : (engineMarket(engine)?.symbol ?? level.market_id);
  if (fate === "active" && position && engine !== undefined) {
    const whole = level.size >= position.size ? "Whole position" : "Part of it";
    return (
      <OrderRow
        marketId={level.market_id}
        takeProfit={level.takeProfit}
        price={level.triggerPrice}
        title={`${symbol} ${position.isLong ? "long" : "short"}`}
        detail={`${whole} · expires ${day(level.expiry)}`}
        onPress={() => router.push(positionRoute(String(engine)))}
        index={index}
      />
    );
  }
  const when = fate === "expired" ? level.expiry : (level.closedAt ?? level.placedAt);
  const ended = fate === "ended";
  return (
    <OrderRow
      marketId={level.market_id}
      takeProfit={level.takeProfit}
      price={level.triggerPrice}
      title={symbol}
      detail={ended ? FATE_WORD.ended : `${FATE_WORD[fate as Exclude<Fate, "active">]} · ${day(when)}`}
      detailTone={fate === "filled" ? color.up : undefined}
      index={index}
      {...(engine === undefined ? {} : { onPress: () => router.push(marketRoute(symbol)) })}
      trailing={
        ended ? (
          <Pressable
            onPress={() => void orders.cancel(level.id)}
            disabled={orders.pending !== undefined || orders.unresolved || !orders.ready}
            accessibilityRole="button"
            accessibilityLabel="Remove this leftover level"
            hitSlop={SPACE.sm}
          >
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: color.link }]}>
              {orders.pending === level.id ? "Removing…" : "Remove"}
            </Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md },
});
