/**
 * The app's one live stream (`@senryo/live`, D-272/D-280): `expo/fetch` streams the SSE body natively (no native
 * module, D-270). Public prices and prints always; the user's topic once this run has an API session — a stream ticket
 * never prompts on its own.
 */
import { latestPricesRoute, recentPricesRoute, streamTicketRoute, timeRoute } from "@senryo/api-client";
import { Live } from "@senryo/live";
import { fetch as expoFetch } from "expo/fetch";
import { api, apiSessionScope } from "~/lib/account/api";
import { ENV } from "~/lib/env";

let live: Live | undefined;

export function appLive(): Live {
  live ??= new Live({
    origin: ENV.API_ORIGIN,
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    recent: (symbols) => api().call(recentPricesRoute, { query: { symbols: symbols.join(",") } }),
    latest: () => api().call(latestPricesRoute, {}),
    time: async () => (await api().call(timeRoute, {})).t,
    ticket: async () => (apiSessionScope() ? (await api().call(streamTicketRoute, {})).ticket : undefined),
  });
  return live;
}
