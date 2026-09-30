import { engineMarket } from "@senryo/config";
import { Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { EmptyState } from "~/components/kit/states";
import { PositionDetail } from "~/features/positions/PositionDetail";

/** `/positions/[id]` — id is the engine market id (one net position per market). */
export default function PositionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const market = engineMarket(Number(id));
  return (
    <Screen>
      <Stack.Screen options={{ title: market ? `${market.symbol} position` : "Position" }} />
      {market ? (
        <PositionDetail marketId={market.id} />
      ) : (
        <EmptyState why="Unknown position" detail="This link doesn't match a market on this network." />
      )}
    </Screen>
  );
}
