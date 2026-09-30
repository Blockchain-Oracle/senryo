import { Stack } from "expo-router";
import { CandleChart } from "~/components/charts/CandleChart";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Screen } from "~/components/kit/Screen";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { SAMPLE_BUCKETS, SAMPLE_CANDLES, SAMPLE_MARKETS } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { Ticket } from "./Ticket";
import { TradeHeader } from "./TradeHeader";

/** Trade (D2): market header, candles, ticket. Same screen for the tab root and `/trade/[market]`. */
export function TradeScreen({ marketId, pushed }: { marketId: string; pushed: boolean }) {
  const markets = useSample("markets", SAMPLE_MARKETS);
  const candles = useSample(`candles:${marketId}`, SAMPLE_CANDLES);
  const buckets = useSample("buckets", SAMPLE_BUCKETS);
  return (
    <Screen>
      {pushed ? <Stack.Screen options={{ title: `${marketId}-PERP` }} /> : null}
      <PreviewBadge />
      <ReadingView reading={markets} loading="line" loadingLabel="Reading the oracle">
        {(all) => {
          const market = all.find((m) => m.id === marketId);
          if (!market) {
            return (
              <EmptyState
                why={`No market called ${marketId}`}
                detail="It may have been renamed or isn't listed on this network."
              />
            );
          }
          return (
            <>
              <TradeHeader market={market} />
              <ReadingView reading={candles} loading="chart" loadingLabel="Loading oracle rounds">
                {(list) => <CandleChart candles={list} />}
              </ReadingView>
              {market.status === "soon" ? (
                <EmptyState
                  why={`${market.name} is coming soon`}
                  detail="It opens when a live price feed is available on Monad. Gold and silver trade now."
                />
              ) : (
                <ReadingView reading={buckets} loading="plate" loadingLabel="Reading Free to trade">
                  {(b) => <Ticket market={market} buckets={b} />}
                </ReadingView>
              )}
            </>
          );
        }}
      </ReadingView>
    </Screen>
  );
}
