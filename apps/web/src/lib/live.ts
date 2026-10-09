/**
 * The web app's one live stream (`@senryo/live`, D-272/D-280): the browser's fetch streams the SSE body. Public prices
 * and prints always; the user's topic once this tab has an API session — a stream ticket never prompts on its own.
 */
import { recentPricesRoute, streamTicketRoute } from "@senryo/api-client";
import { Live } from "@senryo/live";
import { api, apiSessionScope } from "@/lib/account/api";
import { ENV } from "@/lib/env";

let live: Live | undefined;

export function appLive(): Live {
  live ??= new Live({
    origin: ENV.API_ORIGIN,
    fetch: (...args) => globalThis.fetch(...args),
    recent: (symbols) => api().call(recentPricesRoute, { query: { symbols: symbols.join(",") } }),
    ticket: async () => (apiSessionScope() ? (await api().call(streamTicketRoute, {})).ticket : undefined),
  });
  return live;
}
