import { engineMarket } from "@senryo/config";
import { DECIMALS } from "@senryo/core";
import { useCandles } from "@senryo/query";
import { Stack } from "expo-router";
import { Text } from "react-native";
import { CandleChart } from "~/components/charts/CandleChart";
import { Screen } from "~/components/kit/Screen";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { useMarketLine } from "~/features/markets/useMarketLine";
import { TYPE, useTheme } from "~/theme";
import { Ticket } from "./Ticket";
import { TradeHeader } from "./TradeHeader";

/** 15-minute candles: ~3 days of Chainlink rounds on a phone-width chart. */
const CHART_INTERVAL = 900;
const MS_PER_SECOND = 1000;

/** Trade (D2): market header, candles from indexed oracle rounds, the ticket. Tab root and `/trade/[market]`. */
export function TradeScreen({ marketId, pushed }: { marketId: string; pushed: boolean }) {
  const meta = engineMarket(marketId);
  return (
    <Screen>
      {pushed ? <Stack.Screen options={{ title: `${marketId}-PERP` }} /> : null}
      {meta ? (
        <EngineTrade marketId={meta.id} symbol={meta.symbol} />
      ) : (
        <EmptyState
          why={`${marketId} isn't tradable here yet`}
          detail="Gold and silver trade now on Senryo's engine; crypto on Perpl arrives next."
        />
      )}
    </Screen>
  );
}

function EngineTrade({ marketId, symbol }: { marketId: number; symbol: string }) {
  const { color } = useTheme();
  const line = useMarketLine(marketId, symbol);
  const candles = useCandles(symbol, CHART_INTERVAL);
  return (
    <ReadingView reading={line} loading="line" loadingLabel="Reading the oracle">
      {(l) => (
        <>
          <TradeHeader line={l} />
          <ReadingView reading={candles} loading="chart" loadingLabel="Loading Chainlink rounds">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState why="No rounds in this window yet" detail="The chart fills as Chainlink publishes." />
              ) : (
                <CandleChart
                  decimals={DECIMALS.e18}
                  candles={rows.map((c) => ({
                    t: c.openTime * MS_PER_SECOND,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                  }))}
                />
              )
            }
          </ReadingView>
          <Text style={[TYPE.micro, { color: color.inkMuted }]}>Chainlink {symbol}/USD · Monad · 15m</Text>
          <Ticket market={l.market} />
        </>
      )}
    </ReadingView>
  );
}
