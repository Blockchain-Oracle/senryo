"use client";

/**
 * F05 practice starter claim (D-030): sign StarterDrip's `Claim` with the scoped session (in scope → no prompt while
 * unlocked; one passkey prompt when locked), the sponsor relays it (`POST /v1/starter/claim`), and the stage label
 * follows the relay until the claim is finalized — the TTFT stop (D-037). A relay found in `status.lastRelay` (e.g.
 * after a reload mid-claim) is resumed, never re-signed. Never auto-retries a signed claim.
 */
import { classifyAuthError, isSilent, signStarterClaim } from "@senryo/account";
import { useCallback, useEffect, useState } from "react";
import { ACTIVE_NETWORK, RELAY_POLL_MAX, RELAY_POLL_MS } from "@/lib/constants/auth";
import { policyContext } from "./api";
import { ttftStop } from "./measure";
import { useAccount } from "./provider";
import { isTerminal, type RelayResult, StarterError, type StarterErrorCode, starter } from "./starter";

export type StarterPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "signing" }
  | { kind: "sending" }
  | { kind: "settling"; relay: RelayResult }
  | { kind: "done"; creditUsd6: bigint }
  | { kind: "claimed" }
  | { kind: "failed"; code: StarterErrorCode | "AUTH"; retryAfterSec?: number; authKind?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useStarter() {
  const account = useAccount();
  const [phase, setPhase] = useState<StarterPhase>({ kind: "idle" });
  const address = account.hint?.address;

  const follow = useCallback(async (first: RelayResult) => {
    let relay = first;
    for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i += 1) {
      setPhase({ kind: "settling", relay });
      await sleep(RELAY_POLL_MS);
      relay = await starter.relay(relay.relayId);
    }
    if (relay.stage !== "finalized") return setPhase({ kind: "failed", code: "RELAY_REVERTED" });
    ttftStop(Date.now());
    setPhase({ kind: "done", creditUsd6: relay.creditUsd6 });
  }, []);

  useEffect(() => {
    if (!address) return;
    let live = true;
    setPhase({ kind: "checking" });
    starter
      .status(ACTIVE_NETWORK.chainId, address)
      .then((s) => {
        if (!live) return;
        const last = s.lastRelay;
        if (last && last.kind === "claim" && !isTerminal(last)) return void follow(last).catch(() => undefined);
        setPhase(s.claimed ? { kind: "claimed" } : { kind: "idle" });
      })
      // Status unknown (relay offline): stay claimable; the claim itself reports the honest reason.
      .catch(() => live && setPhase({ kind: "idle" }));
    return () => {
      live = false;
    };
  }, [address, follow]);

  const claim = useCallback(async () => {
    const client = account.client;
    if (!client || !address) return;
    try {
      setPhase({ kind: "signing" });
      const signer = client.signer(policyContext(address, account.settings.faceId));
      const signed = await signStarterClaim(signer, ACTIVE_NETWORK.chainId, Date.now());
      setPhase({ kind: "sending" });
      await follow(await starter.claim(signed));
    } catch (error) {
      if (error instanceof StarterError) {
        if (error.code === "ALREADY_CLAIMED") return setPhase({ kind: "claimed" });
        return setPhase({
          kind: "failed",
          code: error.code,
          ...(error.retryAfterSec ? { retryAfterSec: error.retryAfterSec } : {}),
        });
      }
      const kind = classifyAuthError(error);
      setPhase(isSilent(kind) ? { kind: "idle" } : { kind: "failed", code: "AUTH", authKind: kind });
    }
  }, [account.client, account.settings.faceId, address, follow]);

  return { phase, claim, ready: account.status === "ready" && address !== undefined };
}
