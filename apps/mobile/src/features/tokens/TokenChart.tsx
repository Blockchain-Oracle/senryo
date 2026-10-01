/**
 * A token's price chart (J11): candles of the token's own Uniswap v4 pool in USD from GeckoTerminal, which indexes the
 * pool's swaps, drawn by the shared `HistoryChart`.
 */
import type { SpotToken } from "@senryo/config";
import { useTokenCandles } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HistoryChart } from "~/components/charts/HistoryChart";
import { DEFAULT_PERIOD, type PeriodKey, periodOf } from "~/features/markets/periods";

export function TokenChart({ token, priceUsd18 }: { token: SpotToken; priceUsd18: bigint | undefined }) {
  const client = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const candles = useTokenCandles(token, periodOf(period).interval);
  return (
    <HistoryChart
      reading={candles}
      period={period}
      onPeriod={setPeriod}
      priceUsd18={priceUsd18}
      caption={`${token.symbol}/USD · Uniswap v4 pool`}
      loadingLabel="Loading the pool's trades"
      retry={() => void client.invalidateQueries({ queryKey: ["spot"] })}
    />
  );
}
