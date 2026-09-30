import { fromQuery, type Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { SAMPLE_LATENCY_MS } from "./constants/time";

/**
 * A preview read: resolves `value` after a short delay through TanStack Query, so every shell screen exercises the real
 * path (skeleton → value → stale on pull-to-refresh) that S6–S8 queries will take. Swap for the real hook per screen.
 */
export function useSample<T>(key: string, value: T): Reading<T> {
  const query = useQuery({
    queryKey: ["sample", key],
    queryFn: () => new Promise<T>((resolve) => setTimeout(() => resolve(value), SAMPLE_LATENCY_MS)),
  });
  return fromQuery(query);
}
