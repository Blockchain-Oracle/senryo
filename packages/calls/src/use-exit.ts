/**
 * Set, change or remove a call's exit (S8.4, D-292), both apps: one-tap signs with no prompt (and the exit outlives the
 * session), otherwise one Face ID; the relay sends it gas-free and the ticket's exit arrives on the user's stream. The
 * sheet checks the prices first (`exitProblem`); the chain checks them again.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { setExitRoute } from "@senryo/api-client";
import { callExitLevels } from "@senryo/chain";
import type { CadenceSec } from "@senryo/config";
import { type ExitPrices, hasExit } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { marketKeys, useCatalog, useMarketAccount, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import { PROMPTS } from "./constants.ts";
import { type BidBounds, bidBoundsOf } from "./exits.ts";
import type { SignDeps } from "./sign.ts";

const signing = () => Promise.all([import("./sign.ts"), import("./delegates.ts")]);

export type ExitResult = { kind: "sent"; via: "one-tap" | "face-id" } | { kind: "cancelled" };

/** Exits for calls in `cadenceSec`'s lane (its spread curve sets the bids an exit can name). */
export function useExitActions({ client, hint }: Caller, cadenceSec: CadenceSec) {
  const env = useQueryEnv();
  const live = useLive();
  const queries = useQueryClient();
  const owner = hint?.address;
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const [pending, setPending] = useState(false);
  // Pending from the tap, before the signing code loads; one set at a time (D3).
  const inflight = useRef(false);
  const ready = Boolean(client && owner && "value" in catalog && "value" in account);
  const bounds: BidBounds | null = useMemo(
    () => ("value" in catalog ? bidBoundsOf(catalog.value.terms, cadenceSec) : null),
    [catalog, cadenceSec],
  );

  const set = useCallback(
    async (ticketId: bigint, prices: ExitPrices): Promise<ExitResult> => {
      if (!client || !owner || !("value" in catalog) || !("value" in account)) {
        throw new Error("Still loading your account · try again in a moment");
      }
      if (inflight.current) return { kind: "cancelled" };
      inflight.current = true;
      setPending(true);
      try {
        const [{ signExit }, { appDelegates }] = await signing();
        const deps: SignDeps = {
          chainId: env.chainId,
          client,
          delegates: appDelegates(),
          reserve: catalog.value.contracts.reserve,
          account: account.value,
          nowSec: live.clock.nowSec(),
        };
        const prompt = hasExit(prices) ? PROMPTS.exit : PROMPTS.clearExit;
        const signed = await signExit(deps, { owner, ...callExitLevels(ticketId, prices) }, prompt);
        const r = await env.api.call(setExitRoute, {
          body: { chainId: env.chainId, order: signed.order, signature: signed.signature },
        });
        void queries.invalidateQueries({ queryKey: marketKeys.tickets(env.chainId, owner) });
        if (r.state === "reverted") throw new Error("Refused on chain. Nothing changed.");
        return { kind: "sent", via: signed.via };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return { kind: "cancelled" };
        throw error;
      } finally {
        inflight.current = false;
        setPending(false);
      }
    },
    [client, owner, catalog, account, env.chainId, env.api, live, queries],
  );

  return { ready, pending, bounds, set };
}
