/**
 * K — the window's open print, the line every call in it settles against: the boundary print as it streams, else (the
 * app opened mid-window) the api's archive of that instant. Undefined until the print exists; a terminal never draws
 * a guessed line.
 */
import { printRoute } from "@senryo/api-client";
import { useBoundaryPrint } from "@senryo/live/react";
import { useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";

/** The print exists about a second after the boundary; the archive answers soon after. */
const RETRY_MS = 1_000;
const RETRIES = 10;

export function useWindowOpen(symbol: string, start: number, nowSec: number): bigint | undefined {
  const { api } = useQueryEnv();
  const streamed = useBoundaryPrint(symbol, start);
  const archived = useQuery({
    queryKey: ["prices", "print", symbol, start],
    queryFn: async () => BigInt((await api.call(printRoute, { query: { symbol, t: start } })).priceE8),
    enabled: !streamed && nowSec > start,
    staleTime: Number.POSITIVE_INFINITY,
    retry: RETRIES,
    retryDelay: RETRY_MS,
  });
  return streamed?.priceE8 ?? archived.data;
}
