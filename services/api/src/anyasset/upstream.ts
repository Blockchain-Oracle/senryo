/**
 * Plumbing shared by every any-asset provider: a timed JSON fetch whose errors never carry the URL (Alchemy and Aurora
 * keys travel in the path), a TTL cache that coalesces concurrent loads, and exact decimal-string → integer parsing for
 * provider numbers (prices, percents) — never through a float.
 */
import { MS_PER_SECOND } from "@senryo/service-common";
import { PROVIDER_TIMEOUT_MS } from "./constants.ts";

export class UpstreamError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number | null,
    message: string,
    /** Seconds until the provider accepts calls again (429 reset), when it said. */
    readonly retryAfterSec?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "UpstreamError";
  }
}

const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY = 429;

export interface FetchJsonOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** Return `null` for a 404 instead of throwing (status endpoints answer 404 before they know an id). */
  notFoundAsNull?: boolean;
}

/** GET/POST JSON with a timeout. Errors name the provider and status only (never the URL or a key). */
export async function fetchJson(
  provider: string,
  url: string,
  options: FetchJsonOptions = {},
): Promise<{ json: unknown; headers: Headers } | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(options.timeoutMs ?? PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    throw new UpstreamError(provider, null, timeout ? "timed out" : "unreachable");
  }
  if (response.status === HTTP_NOT_FOUND && options.notFoundAsNull) return null;
  if (!response.ok) {
    const reset = Number(response.headers.get("x-ratelimit-reset") ?? response.headers.get("retry-after") ?? "");
    const detail = await response
      .json()
      .then((j) => describeBody(j))
      .catch(() => "");
    throw new UpstreamError(
      provider,
      response.status,
      `HTTP ${response.status}${detail ? ` ${detail}` : ""}`,
      response.status === HTTP_TOO_MANY && Number.isFinite(reset) && reset > 0 ? reset : undefined,
    );
  }
  return { json: await response.json(), headers: response.headers };
}

const DETAIL_MAX_CHARS = 120;
function describeBody(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  const text = o.message ?? o.error ?? o.errorCode ?? "";
  return typeof text === "string" ? text.slice(0, DETAIL_MAX_CHARS) : "";
}

export function isRateLimited(error: unknown): error is UpstreamError {
  return error instanceof UpstreamError && error.status === HTTP_TOO_MANY;
}

export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A bounded TTL cache; `load` returns a fresh value or joins the load already in flight for that key. */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; storedAt: number; expires: number }>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    return entry && entry.expires > Date.now() ? entry.value : undefined;
  }

  /** The value even when expired, with its age (ms), for stale-on-failure. */
  peek(key: string): { value: V; ageMs: number } | undefined {
    const entry = this.entries.get(key);
    return entry ? { value: entry.value, ageMs: Date.now() - entry.storedAt } : undefined;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.entries.delete(key);
    const now = Date.now();
    this.entries.set(key, { value, storedAt: now, expires: now + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  async load(key: string, ttlMs: number, loader: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const running = this.inflight.get(key);
    if (running) return running;
    const work = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, work);
    return work;
  }
}

const DECIMAL_TEXT = /^(-)?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;
const TEN = 10n;

/**
 * Exact parse of a provider's decimal number ("4899.4454", "1.2e-7", "-0.21") into an integer with `decimals` places,
 * truncating extra digits. `undefined` for anything that isn't a plain decimal.
 */
export function decimalToUnits(text: unknown, decimals: number): bigint | undefined {
  if (typeof text !== "string" && typeof text !== "number") return undefined;
  const match = DECIMAL_TEXT.exec(String(text).trim());
  if (!match) return undefined;
  const [, sign, whole = "", fraction = "", exponent = "0"] = match;
  if (whole === "" && fraction === "") return undefined;
  const digits = BigInt(`${whole}${fraction}` || "0");
  const shift = decimals - fraction.length + Number(exponent);
  const value = shift >= 0 ? digits * TEN ** BigInt(shift) : digits / TEN ** BigInt(-shift);
  return sign ? -value : value;
}

/** A percent string ("12.63") as bps (1263n). */
export const percentToBps = (text: unknown): bigint | undefined => decimalToUnits(text, 2);

export const nowSec = (): number => Math.floor(Date.now() / MS_PER_SECOND);

/** `Promise.allSettled` with each result tagged by its key. */
export async function settleAll<K extends string, T>(
  jobs: ReadonlyArray<readonly [K, () => Promise<T>]>,
): Promise<Array<{ key: K; ok: true; value: T } | { key: K; ok: false; error: unknown }>> {
  const results = await Promise.allSettled(jobs.map(([, run]) => run()));
  return results.map((r, i) => {
    const key = jobs[i]?.[0] as K;
    return r.status === "fulfilled" ? { key, ok: true, value: r.value } : { key, ok: false, error: r.reason };
  });
}
