import { usePositions, useTriggers } from "@senryo/query";
import { router, Stack } from "expo-router";
import { View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { useAccountRetry } from "~/features/portfolio/account";
import { engineMarketIndex } from "~/features/portfolio/market-id";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { OrderRow } from "~/features/positions/OrderRow";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";

/**
 * Orders (Orders / triggers in the screen inventory): the account's active TP/SL triggers on this network, read from
 * the indexer — each a bare row that opens its position, where it is cancelled or replaced. Only placed triggers are
 * indexed for this screen today, so there are no completed or cancelled tabs to show. A guest and an account with no
 * triggers each get one quiet line.
 */
export default function OrdersScreen() {
  const address = useAccount().hint?.address;
  const triggers = useTriggers(address);
  const positions = usePositions(address);
  const retry = useAccountRetry();
  const held = positions.status === "fresh" || positions.status === "stale" ? positions.value : [];
  return (
    <Screen>
      <Stack.Screen options={{ title: "Orders" }} />
      {!address ? (
        <QuietLine action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}>
          Take-profit and stop-loss levels appear here once you have an account.
        </QuietLine>
      ) : triggers.status === "unknown" ? (
        <PositionRowsSkeleton />
      ) : (
        <ReadingView reading={triggers} retry={retry}>
          {(list) =>
            list.length === 0 ? (
              <QuietLine action={{ label: "Browse markets", onPress: () => router.navigate(ROUTES.markets) }}>
                No open orders · take-profit and stop-loss levels you set on a position show here.
              </QuietLine>
            ) : (
              <View>
                {list.map((t, i) => (
                  <OrderRow
                    key={t.id}
                    trigger={t}
                    position={held.find((p) => p.marketId === engineMarketIndex(t.market_id))}
                    index={i}
                  />
                ))}
              </View>
            )
          }
        </ReadingView>
      )}
    </Screen>
  );
}
