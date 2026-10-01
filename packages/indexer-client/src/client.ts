/**
 * A minimal GraphQL-over-HTTP client for the indexer's Hasura endpoint. Every document carries its query and a zod
 * schema, so a result is either fully parsed (bigint money, typed enums) or an IndexerError — never a partial or a
 * fabricated zero. Transport is the platform `fetch` (web, React Native, Node 24); callers may inject their own.
 */
import type { z } from "zod";
import { DEFAULT_TIMEOUT_MS, GRAPHQL_PATH } from "./constants.ts";

export type IndexerErrorKind = "http" | "graphql" | "parse" | "timeout" | "network";

/** Plain fields (no parameter properties) so the file runs under Node's type stripping as well as bundlers. */
export class IndexerError extends Error {
  override readonly name = "IndexerError";
  readonly kind: IndexerErrorKind;
  readonly status: number | undefined;
  constructor(kind: IndexerErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/**
 * A Hasura `where` passed as a `$where` variable. Every indexer row exists once per chain (D-173), so the filter can't
 * be built without its chain; the `indexer-docs-chain-filter` invariant requires this type on every `$where` document.
 */
export type ChainWhere = { chainId: { _eq: number } } & Record<string, unknown>;

/** A named query, its variables type and the schema that parses its `data`. */
export interface IndexerDocument<Vars, Result> {
  readonly name: string;
  readonly query: string;
  readonly parse: (data: unknown) => Result;
  /** Phantom marker so `request` infers the variables type. */
  readonly vars?: Vars;
}

/** Curried so the variables type is explicit and the result type is inferred from the schema:
 *  `defineDocument<AccountVars>()("Portfolio", query, schema)`. */
export function defineDocument<Vars>() {
  return <Schema extends z.ZodType>(
    name: string,
    query: string,
    schema: Schema,
  ): IndexerDocument<Vars, z.output<Schema>> => ({
    name,
    query,
    parse: (data) => {
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new IndexerError("parse", `${name}: ${parsed.error.message}`);
      return parsed.data;
    },
  });
}

export type ResultOf<D> = D extends IndexerDocument<unknown, infer R> ? R : never;
export type VarsOf<D> = D extends IndexerDocument<infer V, unknown> ? V : never;

export interface IndexerClientOptions {
  /** Full GraphQL endpoint, e.g. `graphqlEndpoint(INDEXER_ORIGIN)`. */
  url: string;
  fetch?: typeof fetch;
  /** Extra headers (e.g. a rate-limit key). Never an admin secret in an app bundle. */
  headers?: Readonly<Record<string, string>>;
  timeoutMs?: number;
}

export interface IndexerClient {
  request<Vars, Result>(
    document: IndexerDocument<Vars, Result>,
    variables: Vars,
    signal?: AbortSignal,
  ): Promise<Result>;
}

export function graphqlEndpoint(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${GRAPHQL_PATH}`;
}

interface GraphqlResponse {
  data?: unknown;
  errors?: ReadonlyArray<{ message?: string }>;
}

export function createIndexerClient(options: IndexerClientOptions): IndexerClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async request(document, variables, signal) {
      // AbortController + setTimeout rather than AbortSignal.timeout/any, which Hermes does not ship.
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort);
      let response: Response;
      try {
        response = await doFetch(options.url, {
          method: "POST",
          headers: { "content-type": "application/json", ...options.headers },
          body: JSON.stringify({ operationName: document.name, query: document.query, variables }),
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) throw new IndexerError("timeout", `${document.name}: no answer in ${timeoutMs} ms`);
        throw new IndexerError("network", `${document.name}: ${error instanceof Error ? error.message : "failed"}`);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
      if (!response.ok) throw new IndexerError("http", `${document.name}: HTTP ${response.status}`, response.status);
      const body = (await response.json()) as GraphqlResponse;
      if (body.errors?.length) {
        const message = body.errors.map((e) => e.message ?? "unknown").join("; ");
        throw new IndexerError("graphql", `${document.name}: ${message}`);
      }
      return document.parse(body.data);
    },
  };
}
