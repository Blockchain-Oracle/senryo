import { engineMarket } from "@senryo/config";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { PositionDetail } from "~/features/positions/PositionDetail";

/**
 * `/positions/[id]` — id is the engine market id (one net position per market). A pushed page; `PositionDetail` owns
 * the scroll and the pinned close action under it.
 */
export default function PositionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const market = engineMarket(Number(id));
  return (
    <>
      <Stack.Screen options={{ title: market ? `${market.symbol} position` : "Position" }} />
      {market ? (
        <PositionDetail marketId={market.id} />
      ) : (
        <Screen>
          <QuietLine action={{ label: "Go back", onPress: () => router.back() }}>
            This link doesn’t match a market on this network.
          </QuietLine>
        </Screen>
      )}
    </>
  );
}
