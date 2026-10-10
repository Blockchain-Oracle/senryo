import type { Hex } from "@senryo/chain";
import { HTTP_STATUS } from "@senryo/service-common";
import { HERMES_CHANNEL, REST_TIMEOUT_MS } from "./constants.ts";
import { type HermesMessage, idsQuery, isAuthRefusal, updatesOf } from "./hermes.ts";
import type { PriceUpdate } from "./ring.ts";
import type { UpstreamOutcome } from "./upstream.ts";

/**
 * Hermes REST, called only by the `PrintFetcher` (its rate and backoff): the print of an instant for many feeds of one
 * class in one call, and the latest update (the silence watch's probe). Unknown ids are ignored rather than failing
 * the call; 404 is "no such print", not a failure.
 */
export interface HermesAccess {
  origin: string;
  key: string;
}

/** The key, the entitlement, the rate or the service: the caller rests. Other 4xx are our own asks. */
function rests(status: number): boolean {
  return isAuthRefusal(status) || status === HTTP_STATUS.tooMany || status >= HTTP_STATUS.internal;
}

async function updatesAt(access: HermesAccess, path: string): Promise<UpstreamOutcome<Map<Hex, PriceUpdate>>> {
  try {
    const res = await fetch(`${access.origin}${path}`, {
      headers: { authorization: `Bearer ${access.key}` },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (res.status === HTTP_STATUS.notFound) return { kind: "missing" };
    if (!res.ok) return { kind: "failed", reason: `HTTP ${res.status}`, rest: rests(res.status) };
    const updates = updatesOf((await res.json()) as HermesMessage, Date.now());
    return { kind: "ok", value: new Map(updates.map((u) => [u.feedId, u])) };
  } catch (error) {
    return { kind: "failed", reason: (error as Error).name, rest: true };
  }
}

/** For each feed, the first update whose publish time is ≥ t: the unique print of t. */
export function hermesPrintsAt(access: HermesAccess, feedIds: readonly Hex[], t: number) {
  return updatesAt(
    access,
    `/v2/updates/price/${t}?${idsQuery(feedIds)}&encoding=hex&parsed=true&ignore_invalid_price_ids=true`,
  );
}

/** Each feed's latest update on the stream's channel. */
export function hermesLatest(access: HermesAccess, feedIds: readonly Hex[]) {
  return updatesAt(
    access,
    `/v2/updates/price/latest?${idsQuery(feedIds)}&encoding=hex&parsed=true&ignore_invalid_price_ids=true` +
      `&channel=${HERMES_CHANNEL}`,
  );
}
