import {
  type PredictionListQuery,
  type PredictionProvider,
  predictionDetailRoute,
  predictionHistoryRoute,
  predictionsRoute,
} from "@senryo/api-client";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { readingOf } from "./reading.ts";

const REFRESH_MS = 20_000;
/** Public venue reads in either money mode; queries never ask for an account or alter its chain. */
export function usePredictions(input: PredictionListQuery, enabled = true) {
  const { api } = useQueryEnv();
  const query = useQuery({
    queryKey: ["predictions", input.provider, input.asset, input.window, input.state],
    queryFn: ({ signal }) => api.call(predictionsRoute, { query: input }, { signal }),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    enabled,
  });
  return { reading: readingOf(query, REFRESH_MS), retry: () => void query.refetch() };
}
export function usePrediction(provider: PredictionProvider, id: string, enabled = true) {
  const { api } = useQueryEnv();
  const query = useQuery({
    queryKey: ["prediction", provider, id],
    queryFn: ({ signal }) => api.call(predictionDetailRoute, { params: { provider, id } }, { signal }),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    enabled,
  });
  return { reading: readingOf(query, REFRESH_MS), retry: () => void query.refetch() };
}
export function usePredictionHistory(provider: PredictionProvider, id: string, outcome: number, enabled = true) {
  const { api } = useQueryEnv();
  const query = useQuery({
    queryKey: ["prediction-history", provider, id, outcome],
    queryFn: ({ signal }) =>
      api.call(predictionHistoryRoute, { params: { provider, id }, query: { outcome } }, { signal }),
    enabled: enabled && provider === "polymarket",
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
  return { reading: readingOf(query, REFRESH_MS), retry: () => void query.refetch() };
}
