import type * as z from "zod";
import { DEVICE_HEADER } from "./constants.ts";
import { ApiError, apiErrorBodySchema } from "./errors.ts";
import type { RouteDef } from "./routes/define.ts";

type OutputOf<S> = S extends z.ZodType ? z.output<S> : never;

/** What a call needs: only the parts the route declares (bigints as bigints — the client encodes them). */
export type CallInput<R extends RouteDef> = (R["params"] extends z.ZodType
  ? { params: z.output<R["params"]> }
  : object) &
  (R["query"] extends z.ZodType ? { query: z.output<R["query"]> } : object) &
  (R["body"] extends z.ZodType ? { body: z.output<R["body"]> } : object);

export interface ApiClientOptions {
  /** e.g. `API_ORIGIN` from `@senryo/config` (or the parsed public env). */
  origin: string;
  /** Session token for `session` routes (from `POST /v1/auth/verify`). */
  getToken?: () => string | null | undefined;
  /** Per-install device hash (rate limits); never PII. */
  deviceHash?: string;
  fetch?: typeof fetch;
}

export interface ApiClient {
  call<R extends RouteDef>(
    route: R,
    input: CallInput<R>,
    init?: { signal?: AbortSignal },
  ): Promise<OutputOf<R["response"]>>;
}

const HTTP_NO_CONTENT = 204;
const JSON_TYPE = "application/json";

function fillPath(path: string, params: Record<string, unknown> | undefined): string {
  return path.replace(/:([A-Za-z]+)/g, (_, key: string) => encodeURIComponent(String(params?.[key] ?? "")));
}

function toQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function readError(response: Response): Promise<ApiError> {
  const parsed = apiErrorBodySchema.safeParse(await response.json().catch(() => null));
  if (parsed.success) return new ApiError(response.status, parsed.data.error);
  return new ApiError(response.status, { code: "INTERNAL", message: `HTTP ${response.status}` });
}

/** A tiny zod-checked fetch client: encodes inputs with the route's codecs and decodes the response (bigints back). */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  return {
    async call<R extends RouteDef>(
      route: R,
      input: CallInput<R>,
      init?: { signal?: AbortSignal },
    ): Promise<OutputOf<R["response"]>> {
      const parts = input as { params?: unknown; query?: unknown; body?: unknown };
      const params = route.params ? (route.params.encode(parts.params) as Record<string, unknown>) : undefined;
      const query = route.query ? (route.query.encode(parts.query) as Record<string, unknown>) : undefined;
      const headers: Record<string, string> = { accept: JSON_TYPE };
      if (options.deviceHash) headers[DEVICE_HEADER] = options.deviceHash;
      if (route.auth === "session") {
        const token = options.getToken?.();
        if (!token) throw new ApiError(0, { code: "UNAUTHORIZED", message: "no API session; sign in first" });
        headers.authorization = `Bearer ${token}`;
      } else if (route.auth === "optional") {
        const token = options.getToken?.();
        if (token) headers.authorization = `Bearer ${token}`;
      }
      let body: string | undefined;
      if (route.body) {
        headers["content-type"] = JSON_TYPE;
        body = JSON.stringify(route.body.encode(parts.body));
      }
      const url = `${options.origin}${fillPath(route.path, params)}${toQuery(query)}`;
      const response = await doFetch(url, {
        method: route.method,
        headers,
        ...(body === undefined ? {} : { body }),
        ...(init?.signal ? { signal: init.signal } : {}),
      });
      if (!response.ok) throw await readError(response);
      const json: unknown = response.status === HTTP_NO_CONTENT ? {} : await response.json();
      // `parse` on a codec runs the decode direction (strings → bigints).
      return route.response.parse(json) as OutputOf<R["response"]>;
    },
  };
}
