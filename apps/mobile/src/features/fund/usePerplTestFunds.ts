/**
 * "Get test money" for Perpl (real venues, Stage 1): the sponsor sends Agora's test AUSD — Perpl's testnet collateral —
 * to the signed-in Practice wallet (`POST /v1/practice/perpl-funds`). No Face ID and no gas for the user; the phase
 * follows the relay to finality, then the account's balances and Perpl picture re-read. One per day (server rule).
 */

import { TESTNET_CHAIN_ID } from "@senryo/config";
import { keys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { withSession } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { isTerminal, type RelayResult, StarterError, type StarterErrorCode, starter } from "~/lib/account/starter";
import { RELAY_POLL_MAX, RELAY_POLL_MS } from "~/lib/constants/auth";

export type TestFundsPhase =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "settling"; relay: RelayResult }
  | { kind: "done"; creditCns: bigint }
  | { kind: "failed"; code: StarterErrorCode; retryAfterSec?: number | undefined };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function usePerplTestFunds() {
  const env = useQueryEnv();
  const account = useAccount();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  const [phase, setPhase] = useState<TestFundsPhase>({ kind: "idle" });
  const available = env.chainId === TESTNET_CHAIN_ID && address !== undefined;
  const busy = phase.kind === "sending" || phase.kind === "settling";

  const request = useCallback(async () => {
    const client = account.client;
    if (!client || !address || env.chainId !== TESTNET_CHAIN_ID || busy) return;
    setPhase({ kind: "sending" });
    try {
      let relay = await starter.perplFunds(env.chainId, (run) => withSession(client, account.settings.faceId, run));
      for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i++) {
        setPhase({ kind: "settling", relay });
        await sleep(RELAY_POLL_MS);
        relay = await starter.relay(relay.relayId);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) }),
        queryClient.invalidateQueries({ queryKey: keys.perpl(address, env.chainId) }),
      ]);
      if (relay.stage === "finalized") setPhase({ kind: "done", creditCns: relay.creditUsd6 });
      else setPhase({ kind: "failed", code: isTerminal(relay) ? "RELAY_REVERTED" : "RELAYER_BUSY" });
    } catch (error) {
      const failure = error instanceof StarterError ? error : new StarterError("UNKNOWN");
      setPhase({ kind: "failed", code: failure.code, retryAfterSec: failure.retryAfterSec });
    }
  }, [account.client, account.settings.faceId, address, busy, env.chainId, queryClient]);

  return { phase, available, busy, request, reset: () => setPhase({ kind: "idle" }) };
}
