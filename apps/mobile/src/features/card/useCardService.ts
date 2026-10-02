/**
 * The card service's write routes (E1, E3, E4) as mutations on the session: issue, freeze, unfreeze, simulate a
 * payment, and the sandbox follow-ups (settle, void, refund). Every success refreshes the summary; the issue response
 * is the summary itself, so it goes straight into the cache.
 */
import {
  type CardSimulatePreset,
  type CardSimulateResult,
  type CardSummary,
  cardEmbedRoute,
  cardFreezeRoute,
  cardIssueRoute,
  cardSimulateRoute,
  cardSimulateStepRoute,
  cardUnfreezeRoute,
} from "@senryo/api-client";
import { useQueryEnv } from "@senryo/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { cardSummaryKey } from "./useCardSummary";

export type SimulateStep = "clear" | "void" | "return";

function useRunner() {
  const env = useQueryEnv();
  const session = useSessionRunner();
  const cache = useQueryClient();
  const address = useAccount().hint?.address;
  const key = cardSummaryKey(env.chainId, address);
  const run = <T>(call: () => Promise<T>): Promise<T> =>
    session ? session(call) : Promise.reject(new Error("Sign in to use your card"));
  const refresh = () => cache.invalidateQueries({ queryKey: key });
  return { env, run, refresh, cache, key };
}

/** How long the issuer's details link stays valid (the sheet also hides itself after this). */
export const EMBED_TTL_SEC = 60;

export function useIssueCard() {
  const { env, run, cache, key } = useRunner();
  return useMutation({
    mutationFn: () => run(() => env.api.call(cardIssueRoute, { body: {} })),
    // The response is the summary after issuance (plus the new card's token): it is the cache's next value.
    onSuccess: (issued) => cache.setQueryData<CardSummary>(key, issued),
  });
}

/** The issuer side of a freeze (the onchain revoke is `useCardAllowance().freeze`). */
export function useFreezeCard() {
  const { env, run, refresh } = useRunner();
  return useMutation({
    mutationFn: (cardToken: string) => run(() => env.api.call(cardFreezeRoute, { body: { cardToken, frozen: true } })),
    onSettled: refresh,
  });
}

/** The issuer side of an unfreeze, once the new limit is live onchain. */
export function useUnfreezeCard() {
  const { env, run, refresh } = useRunner();
  return useMutation({
    mutationFn: (cardToken: string) => run(() => env.api.call(cardUnfreezeRoute, { body: { cardToken } })),
    onSettled: refresh,
  });
}

export function useSimulatePayment() {
  const { env, run, refresh } = useRunner();
  return useMutation({
    mutationFn: (input: { cardToken: string; preset: CardSimulatePreset }): Promise<CardSimulateResult> =>
      run(() => env.api.call(cardSimulateRoute, { body: input })),
    onSettled: refresh,
  });
}

export function useSimulateStep() {
  const { env, run, refresh } = useRunner();
  return useMutation({
    mutationFn: (input: { cardToken: string; transactionToken: string; step: SimulateStep }) =>
      run(() => env.api.call(cardSimulateStepRoute, { body: input })),
    // The webhook lands after the response; the lifecycle row follows on the next reads.
    onSettled: refresh,
  });
}

/** The issuer's card-details page for one card: a short-lived URL (E5), fetched only after a passkey step-up. */
export function useCardEmbed() {
  const { env, run } = useRunner();
  return useMutation({
    mutationFn: (cardToken: string) =>
      run(() => env.api.call(cardEmbedRoute, { query: { cardToken, ttlSec: EMBED_TTL_SEC } })),
  });
}
