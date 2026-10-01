/**
 * `GET /v1/geo` (D-038, S8.15): the viewer's country and whether mainnet new risk is allowed there — the ticket's
 * geo blocker on mainnet. Practice is never gated. Unknown (the API couldn't place the IP) allows, as the API does.
 */
import { type GeoResponse, geoRoute } from "@senryo/api-client";
import type { Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { readingOf } from "./reading.ts";

/** Region rarely changes within a session; a VPN toggle shows up on the next refetch. */
export const GEO_STALE_MS = 300_000;

export function useGeo(): Reading<GeoResponse> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["geo"] as const,
    queryFn: () => env.api.call(geoRoute, {}),
    staleTime: GEO_STALE_MS,
  });
  return readingOf(query);
}
