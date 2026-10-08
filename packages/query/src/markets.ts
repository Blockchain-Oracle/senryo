/**
 * The markets for the apps (S5, D-272): the catalogue as deployed, the caller's account (balance, allowance, epoch,
 * session — read by the api, the app makes no RPC calls), open tickets from the services' ticket book, and the writes:
 * a signed call, its status, the session grant and revoke, Practice dollars. Nothing here polls the chain: the user's
 * stream events invalidate these keys (`live-sync.ts`), with a slow fallback refetch for a missed event.
 */
import {
  type CallInput,
  catalogRoute,
  grantSessionRoute,
  intentStatusRoute,
  marketAccountRoute,
  practiceGrantRoute,
  revokeSessionRoute,
  submitIntentRoute,
  ticketsRoute,
  windowLoadRoute,
  withdrawRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import type { SessionRunner } from "./profiles.ts";

/** Balances, positions and sessions refresh on the user's own events; this is the fallback for a missed one. */
export const ACCOUNT_FALLBACK_MS = 30_000;
/** While a call is pending its status is pushed; this slow poll covers a stream that is reconnecting. */
export const INTENT_FALLBACK_MS = 1_000;

export const marketKeys = {
  all: ["markets"] as const,
  catalog: (chainId: ChainId) => ["markets", chainId, "catalog"] as const,
  owner: (chainId: ChainId, owner: Address) => ["markets", chainId, "owner", owner.toLowerCase()] as const,
  account: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "account"] as const,
  tickets: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "tickets"] as const,
  intent: (digest: string) => ["markets", "intent", digest] as const,
  load: (chainId: ChainId, expiry: number) => ["markets", chainId, "load", expiry] as const,
  loads: (chainId: ChainId) => ["markets", chainId, "load"] as const,
};

const CATALOG_RETRIES = 3;
/** While the catalogue is failing, it is asked for again this often. */
const CATALOG_RETRY_MS = 15_000;

/** Other callers move a window's load too: the terminal reads it this often while the window is on screen. */
export const LOAD_POLL_MS = 5_000;

/** The pool's load for one expiry (surcharge and capacity); refreshed on the user's own fills as well. */
export function useWindowLoad(expiry: number | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: marketKeys.load(env.chainId, expiry ?? 0),
    queryFn: ({ signal }) => {
      if (expiry === undefined) throw new Error("no window");
      return env.api.call(windowLoadRoute, { query: { chainId: env.chainId, expiry } }, { signal });
    },
    enabled: expiry !== undefined,
    refetchInterval: LOAD_POLL_MS,
  });
  return fromQuery(query);
}

/** The catalogue as deployed on the active network (markets, cadences, band menus, σ, pool terms). */
export function useCatalog() {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: marketKeys.catalog(env.chainId),
    queryFn: ({ signal }) => env.api.call(catalogRoute, { query: { chainId: env.chainId } }, { signal }),
    staleTime: Number.POSITIVE_INFINITY,
    // Everything rests on it: a failed read keeps trying rather than leaving the app without markets.
    retry: CATALOG_RETRIES,
    refetchInterval: (q) => (q.state.status === "error" ? CATALOG_RETRY_MS : false),
  });
  return fromQuery(query);
}

/** The caller's dollars, allowance, permit nonce, epoch and live session. */
export function useMarketAccount(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: marketKeys.account(env.chainId, owner ?? "0x"),
    queryFn: ({ signal }) => {
      if (!owner) throw new Error("no account");
      return env.api.call(marketAccountRoute, { query: { chainId: env.chainId, owner } }, { signal });
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

/** The caller's tickets from the services' book: open calls with their live state, recent results. */
export function useTickets(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: marketKeys.tickets(env.chainId, owner ?? "0x"),
    queryFn: ({ signal }) => {
      if (!owner) throw new Error("no account");
      return env.api.call(ticketsRoute, { query: { chainId: env.chainId, owner } }, { signal });
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

type SubmitBody = CallInput<typeof submitIntentRoute>["body"];

/** Relay a signed call (idempotent by its EIP-712 digest); its status then arrives on the stream. */
export function useSubmitIntent() {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<SubmitBody, "chainId">) =>
      env.api.call(submitIntentRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: (status) => client.setQueryData(marketKeys.intent(status.digest), status),
  });
}

const SETTLED_INTENT = new Set(["filled", "refused", "failed"]);

/** A relayed call's status: pushed by the stream, with a slow poll only until it settles. */
export function useIntentStatus(digest: `0x${string}` | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: marketKeys.intent(digest ?? ""),
    queryFn: ({ signal }) => {
      if (!digest) throw new Error("no intent");
      return env.api.call(intentStatusRoute, { params: { digest } }, { signal });
    },
    enabled: digest !== undefined,
    refetchInterval: (q) => (q.state.data && SETTLED_INTENT.has(q.state.data.state) ? false : INTENT_FALLBACK_MS),
  });
  return fromQuery(query);
}

type GrantBody = CallInput<typeof grantSessionRoute>["body"];
type RevokeBody = CallInput<typeof revokeSessionRoute>["body"];

/** Turn on one-tap calls: relay the owner's signed session grant (with a permit when the allowance is short). */
export function useGrantSession(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<GrantBody, "chainId">) =>
      env.api.call(grantSessionRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: () => owner && client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) }),
  });
}

/** End one-tap calls now (bumps the epoch: every outstanding session signature dies). */
export function useRevokeSession(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<RevokeBody, "chainId">) =>
      env.api.call(revokeSessionRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: () => owner && client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) }),
  });
}

/** Practice dollars: granted at sign-up, topped up once a day (`already` + `nextAt` otherwise). */
export function usePracticeGrant(owner: Address | undefined, session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!session) throw new Error("Sign in first");
      return session(() => env.api.call(practiceGrantRoute, {}));
    },
    onSuccess: () => owner && client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) }),
  });
}

type WithdrawBody = CallInput<typeof withdrawRoute>["body"];

/** Send dollars out: relay the owner's signed EIP-3009 transfer (no MON needed); the balance refreshes on its event. */
export function useWithdraw(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<WithdrawBody, "chainId">) =>
      env.api.call(withdrawRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: () => owner && client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) }),
  });
}
