/**
 * One-tap calls for the signed-in account (D-267, D-280): whether this device's delegate holds a live grant, how much
 * of it is left, and turning it on (one Face ID: grant + permit for the session cap) or off (one Face ID: revoke).
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { useLive, useServerSeconds } from "@senryo/live/react";
import { useCatalog, useGrantSession, useMarketAccount, useQueryEnv, useRevokeSession } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Caller } from "./caller.ts";
import { ONE_TAP_DEFAULTS, SECONDS_PER_MINUTE, SESSION_MARGIN_SEC, USD } from "./constants.ts";
import { appDelegates } from "./delegates.ts";
import { type OneTapTerms, signOneTap, signRevoke } from "./one-tap.ts";

export type OneTapState =
  | { on: false }
  | { on: true; secondsLeft: number; left: bigint; perCallCap: bigint; sessionCap: bigint };

/** The defaults, inside what the pool allows on this network (catalogue `terms.session`). */
export function defaultOneTapTerms(limits: {
  perCallCap: bigint;
  sessionCap: bigint;
  maxSessionSec: number;
}): OneTapTerms {
  const min = (a: bigint, b: bigint) => (a < b ? a : b);
  return {
    perCallCap: min(BigInt(ONE_TAP_DEFAULTS.perCallUsd) * USD, limits.perCallCap),
    sessionCap: min(BigInt(ONE_TAP_DEFAULTS.sessionUsd) * USD, limits.sessionCap),
    seconds: Math.min(ONE_TAP_DEFAULTS.minutes * SECONDS_PER_MINUTE, limits.maxSessionSec),
  };
}

export function useOneTap({ client, hint }: Caller) {
  const env = useQueryEnv();
  const live = useLive();
  const now = useServerSeconds();
  const owner = hint?.address;
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const grant = useGrantSession(owner);
  const revoke = useRevokeSession(owner);
  const delegate = useQuery({
    queryKey: ["one-tap", "delegate", env.chainId, owner],
    queryFn: async () => (await appDelegates().get(owner ?? "0x", env.chainId))?.address.toLowerCase() ?? null,
    enabled: owner !== undefined,
  });

  const session = "value" in account ? account.value.session : null;
  const mine = session && delegate.data && session.delegate.toLowerCase() === delegate.data;
  const state: OneTapState =
    mine && session.expiry - now > SESSION_MARGIN_SEC
      ? {
          on: true,
          secondsLeft: session.expiry - now,
          left: session.sessionCap - session.spent,
          perCallCap: session.perCallCap,
          sessionCap: session.sessionCap,
        }
      : { on: false };

  const deps = useCallback(() => {
    if (!client || !owner || !("value" in catalog) || !("value" in account)) throw new Error("Not ready");
    return {
      chainId: env.chainId,
      client,
      delegates: appDelegates(),
      reserve: catalog.value.contracts.reserve,
      owner,
      account: account.value,
      nowSec: live.clock.nowSec(),
    };
  }, [client, owner, catalog, account, env.chainId, live]);

  const turnOn = useCallback(
    async (terms?: OneTapTerms): Promise<"on" | "cancelled"> => {
      const d = deps();
      if (!("value" in catalog)) throw new Error("Not ready");
      try {
        const signed = await signOneTap(d, terms ?? defaultOneTapTerms(catalog.value.terms.session));
        await grant.mutateAsync({ grant: signed.grant, signature: signed.signature, permit: signed.permit });
        await delegate.refetch();
        return "on";
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return "cancelled";
        throw error;
      }
    },
    [deps, catalog, grant, delegate],
  );

  const turnOff = useCallback(async (): Promise<"off" | "cancelled"> => {
    const d = deps();
    try {
      const signed = await signRevoke(d);
      await revoke.mutateAsync({ owner: d.owner, ...signed });
      await appDelegates().forget(d.owner, d.chainId);
      await delegate.refetch();
      return "off";
    } catch (error) {
      if (isSilent(classifyAuthError(error))) return "cancelled";
      throw error;
    }
  }, [deps, revoke, delegate]);

  return { state, turnOn, turnOff, busy: grant.isPending || revoke.isPending };
}
