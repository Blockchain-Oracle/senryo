import { engineMarket } from "@senryo/config";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { perplMarketOfPositionId } from "~/features/perpl/market";
import { PerplPositionDetail } from "~/features/perpl/PerplPositionDetail";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { PositionDetail } from "~/features/positions/PositionDetail";

/**
 * `/positions/[id]` — id is the engine market id (one net position per market), or `perpl-<perpId>` for a position
 * on Perpl (D1, the indexer's market id). A pushed page; each detail owns its scroll and the pinned close under it.
 */
export default function PositionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const perpl = perplMarketOfPositionId(id ?? "");
  if (perpl) return <PerplPositionDetail meta={perpl} />;
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
