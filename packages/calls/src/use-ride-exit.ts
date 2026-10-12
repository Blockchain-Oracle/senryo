/**
 * Set or clear a ride's exit (R3.12, R5.5), both apps: take-profit and stop as prices, the trail as a distance in bps
 * of the price with a floor it never fills under (TRAIL arms with break-even as its floor). One-tap signs with no
 * prompt, otherwise one Face ID; the relay sends it gas-free and the ride's exit arrives on the user's `ride` events.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { setExitRoute } from "@senryo/api-client";
import { EXIT_BOOK } from "@senryo/chain";
import type { RideExitLevels } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { rideKeys, useCatalog, useMarketAccount, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Caller } from "./caller.ts";
import { PROMPT_RIDE_EXIT } from "./constants.ts";
import type { SignDeps } from "./sign.ts";
import type { ExitResult } from "./use-exit.ts";

const signing = () => Promise.all([import("./sign.ts"), import("./delegates.ts")]);

export function useRideExit({ client, hint }: Caller) {
  const env = useQueryEnv();
  const live = useLive();
  const queries = useQueryClient();
  const owner = hint?.address;
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const [pending, setPending] = useState(false);
  const ready = Boolean(client && owner && "value" in catalog && "value" in account);

  const set = useCallback(
    async (rideId: bigint, levels: RideExitLevels): Promise<ExitResult> => {
      if (!client || !owner || !("value" in catalog) || !("value" in account)) throw new Error("Not ready yet");
      const [{ signExit }, { appDelegates }] = await signing();
      const deps: SignDeps = {
        chainId: env.chainId,
        client,
        delegates: appDelegates(),
        reserve: catalog.value.contracts.reserve,
        account: account.value,
        nowSec: live.clock.nowSec(),
      };
      setPending(true);
      try {
        const signed = await signExit(
          deps,
          {
            owner,
            book: EXIT_BOOK.ride,
            id: rideId,
            takeProfit: levels.takeProfitE8,
            stopLoss: levels.stopLossE8,
            floor: levels.floorE8,
            trail: BigInt(levels.trailBps),
          },
          PROMPT_RIDE_EXIT,
        );
        const r = await env.api.call(setExitRoute, {
          body: { chainId: env.chainId, order: signed.order, signature: signed.signature },
        });
        void queries.invalidateQueries({ queryKey: rideKeys.of(env.chainId, owner) });
        if (r.state === "reverted") throw new Error("Refused on chain. Nothing changed.");
        return { kind: "sent", via: signed.via };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return { kind: "cancelled" };
        throw error;
      } finally {
        setPending(false);
      }
    },
    [client, owner, catalog, account, env.chainId, env.api, live, queries],
  );

  return { ready, pending, set };
}
