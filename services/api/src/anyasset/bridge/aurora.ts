/**
 * Aurora (NEAR Intents) placeholder + incident watcher (plan §0.8, routes.md §5). Every Aurora endpoint is keyed by
 * the Studio API key in its path (`GET /incidents/{apiKey}`; the keyless path answers 404), so without
 * `AURORA_API_KEY` the provider reports `no_key`. With a key, the incident feed is read at most once a minute; an open
 * incident of type `chain_all` for `monad` reports `incident` (Aurora tiles hidden, "Aurora paused · using Relay").
 * The quote proxy, persistent deposit addresses and the `aurora_deposits` poller come with the key.
 * The incident schema isn't documented beyond the endpoint, so it is read defensively.
 */
import type { BridgeRoutes } from "@senryo/api-client";
import { AURORA_API } from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import { AURORA_POLL_MS } from "../constants.ts";
import { errorText, fetchJson, TtlCache } from "../upstream.ts";

export type AuroraState = BridgeRoutes["aurora"];

const CLOSED = /resolved|closed|done|inactive/i;

function isOpenMonadIncident(incident: unknown): boolean {
  if (!incident || typeof incident !== "object") return false;
  const o = incident as Record<string, unknown>;
  const type = String(o.type ?? o.kind ?? "").toLowerCase();
  const value = String(o.value ?? o.chain ?? o.target ?? "").toLowerCase();
  if (type !== "chain_all" || value !== "monad") return false;
  if (o.resolved === true || o.resolvedAt || o.resolved_at || o.endedAt || o.ended_at) return false;
  return !CLOSED.test(String(o.status ?? o.state ?? ""));
}

function incidentsOf(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const key of ["incidents", "data", "items", "result"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return [];
}

export class AuroraWatcher {
  private readonly cache = new TtlCache<AuroraState>(1);

  constructor(
    private readonly apiKey: string | undefined,
    private readonly log: Logger,
  ) {}

  async state(): Promise<AuroraState> {
    if (!this.apiKey) return { state: "no_key", detail: "Aurora Studio key not configured" };
    const key = this.apiKey;
    return this.cache.load("aurora", AURORA_POLL_MS, async () => {
      try {
        const res = await fetchJson("aurora", `${AURORA_API}/incidents/${key}`);
        const open = incidentsOf(res?.json).filter(isOpenMonadIncident);
        return open.length > 0
          ? { state: "incident", detail: "Aurora paused · using Relay" }
          : { state: "ok", detail: "Aurora quotes are not served yet" };
      } catch (error) {
        this.log.warn({ err: errorText(error) }, "aurora incident feed unreachable");
        return { state: "unreachable", detail: "Aurora incident feed unreachable" };
      }
    });
  }

  /** `/v1/status` component: ok / degraded (incident) / down (unreachable) / unknown (no key). */
  async component(): Promise<{ state: "ok" | "degraded" | "down" | "unknown"; detail: string | null }> {
    const s = await this.state();
    const map = { ok: "ok", incident: "degraded", unreachable: "down", no_key: "unknown" } as const;
    return { state: map[s.state], detail: s.detail };
  }
}
