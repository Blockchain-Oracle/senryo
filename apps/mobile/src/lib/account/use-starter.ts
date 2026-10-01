/**
 * F05 practice starter claim (D-030): sign StarterDrip's `Claim` with the scoped session (in scope → no prompt while
 * unlocked; one Face ID read when locked), the sponsor relays it (`POST /v1/starter/claim`), and the stage label
 * follows the relay until the claim is finalized — the TTFT stop (D-037). Never auto-retries a signed claim.
 *
 * S8.16e (phone test: "why is it showing again?"): the claim state comes from the shared `useStarterStatus` query, not
 * from state rebuilt on every mount. It starts as `checking` (never a flash of the Claim button); an onchain `claimed`
 * wins over a stuck relay row; a status error is "couldn't check · retry", never a Claim button; and a finalized
 * claim invalidates the account (buckets, gas and the status itself) so every screen updates at once.
 */
import { classifyAuthError, isSilent, signStarterClaim } from "@senryo/account";
import { keys, useQueryEnv, useStarterStatus } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { RELAY_POLL_MAX, RELAY_POLL_MS } from "~/lib/constants/auth";
import { policyContext } from "./api";
import { ttftStop, ttftTap } from "./measure";
import { useAccount } from "./provider";
import { isTerminal, type RelayResult, StarterError, type StarterErrorCode, starter } from "./starter";

export type StarterPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "unchecked" }
  | { kind: "signing" }
  | { kind: "sending" }
  | { kind: "settling"; relay: RelayResult }
  | { kind: "done"; creditUsd6: bigint }
  | { kind: "claimed" }
  | { kind: "failed"; code: StarterErrorCode | "AUTH"; retryAfterSec?: number; authKind?: string };

/** Phases driven by this device's own claim; everything else is derived from the status query. */
type ActionPhase = Extract<StarterPhase, { kind: "signing" | "sending" | "settling" | "done" | "failed" }>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useStarter() {
  const account = useAccount();
  const env = useQueryEnv();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  const status = useStarterStatus(address);
  const [action, setAction] = useState<ActionPhase | undefined>(undefined);

  const settled = useCallback(async () => {
    if (address) await queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) });
  }, [address, env.chainId, queryClient]);

  const follow = useCallback(
    async (first: RelayResult) => {
      let relay = first;
      for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i += 1) {
        setAction({ kind: "settling", relay });
        await sleep(RELAY_POLL_MS);
        relay = await starter.relay(relay.relayId);
      }
      if (relay.stage !== "finalized") {
        // The relay row may lag the chain (api restarted mid-claim): re-read the finalized `claimed` before failing.
        await settled();
        return setAction({ kind: "failed", code: "RELAY_REVERTED" });
      }
      ttftStop(Date.now());
      setAction({ kind: "done", creditUsd6: relay.creditUsd6 });
      await settled();
    },
    [settled],
  );

  // A claim left in flight (app killed mid-claim) is resumed, never re-signed — but only while the chain says unclaimed.
  const pending = status.data?.lastRelay;
  const resume =
    status.data && !status.data.claimed && pending?.kind === "claim" && !isTerminal(pending) ? pending : undefined;
  useEffect(() => {
    if (resume && action === undefined) void follow(resume).catch(() => undefined);
  }, [resume, action, follow]);

  const claim = useCallback(async () => {
    const client = account.client;
    if (!client || !address) return;
    ttftTap();
    try {
      setAction({ kind: "signing" });
      const signer = client.signer(policyContext(address, account.settings.faceId));
      const signed = await signStarterClaim(signer, env.chainId, Date.now());
      setAction({ kind: "sending" });
      await follow(await starter.claim(signed));
    } catch (error) {
      if (error instanceof StarterError) {
        if (error.code === "ALREADY_CLAIMED") {
          setAction(undefined);
          return void settled();
        }
        return setAction({
          kind: "failed",
          code: error.code,
          ...(error.retryAfterSec ? { retryAfterSec: error.retryAfterSec } : {}),
        });
      }
      const kind = classifyAuthError(error);
      setAction(isSilent(kind) ? undefined : { kind: "failed", code: "AUTH", authKind: kind });
    }
  }, [account.client, account.settings.faceId, address, env.chainId, follow, settled]);

  const recheck = useCallback(() => {
    setAction(undefined);
    void status.refetch();
  }, [status]);

  const derived: StarterPhase = status.isPending
    ? { kind: "checking" }
    : status.isError
      ? { kind: "unchecked" }
      : status.data.claimed
        ? { kind: "claimed" }
        : { kind: "idle" };
  // A finished `done` stays visible until the user moves on; any other local phase wins over the derived one.
  const phase: StarterPhase = action ?? derived;

  return { phase, claim, recheck, ready: account.ready && address !== undefined };
}
