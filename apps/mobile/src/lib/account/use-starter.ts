/**
 * F05 practice starter claim (D-030): sign StarterDrip's `Claim` with the scoped session (in scope → no prompt while
 * unlocked; one Face ID read when locked), the sponsor relays it, and the stage label follows the relay until the
 * claim is finalized — the TTFT stop (D-037). Never auto-retries a signed claim.
 */
import { classifyAuthError, defaultFaceIdMode, isSilent, type PolicyContext, signStarterClaim } from "@senryo/account";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ACTIVE_NETWORK, DEVICE_ID_BYTES, RELAY_POLL_MAX, RELAY_POLL_MS } from "~/lib/constants/auth";
import { ENV } from "~/lib/env";
import { STORAGE_KEYS, storage } from "~/lib/storage";

import { ttftStop, ttftTap } from "./measure";
import { useAccount } from "./provider";
import { httpStarterClient, type RelayResult, StarterError, type StarterErrorCode, TERMINAL_STAGES } from "./starter";

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
const HEX_RADIX = 16;
const HEX_PER_BYTE = 2;

/** Per-install id for the relay's rate limit (`x-senryo-device`): random, MMKV, not an identity. */
function deviceId(): string {
  const existing = storage.getString(STORAGE_KEYS.device);
  if (existing) return existing;
  const bytes = new Uint8Array(DEVICE_ID_BYTES);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_PER_BYTE, "0")).join("");
  storage.set(STORAGE_KEYS.device, id);
  return id;
}

export function useStarter() {
  const account = useAccount();
  const [phase, setPhase] = useState<StarterPhase>({ kind: "idle" });
  const starter = useMemo(() => httpStarterClient(ENV.API_ORIGIN, deviceId()), []);
  const address = account.hint?.address;

  useEffect(() => {
    if (!address) return;
    let live = true;
    setPhase({ kind: "checking" });
    starter
      .status(ACTIVE_NETWORK.chainId, address)
      .then((s) => live && setPhase(s.claimed ? { kind: "claimed" } : { kind: "idle" }))
      // Status unknown (relay offline): stay claimable; the claim itself reports the honest reason.
      .catch(() => live && setPhase({ kind: "idle" }));
    return () => {
      live = false;
    };
  }, [address, starter]);

  const claim = useCallback(async () => {
    const client = account.client;
    if (!client || !address) return;
    const context = (): PolicyContext => ({
      chainId: ACTIVE_NETWORK.chainId,
      self: address,
      faceId: account.settings.faceId ?? defaultFaceIdMode(ACTIVE_NETWORK.key),
      marketRoomUsd6: () => undefined,
      equityUsd6: () => undefined,
    });
    ttftTap();
    try {
      setPhase({ kind: "signing" });
      const signed = await signStarterClaim(client.signer(context), ACTIVE_NETWORK.chainId, Date.now());
      setPhase({ kind: "sending" });
      let relay = await starter.claim(signed);
      for (let i = 0; i < RELAY_POLL_MAX && !TERMINAL_STAGES.includes(relay.stage); i += 1) {
        setPhase({ kind: "settling", relay });
        await sleep(RELAY_POLL_MS);
        relay = await starter.relay(relay.relayId);
      }
      if (relay.stage !== "finalized") return setPhase({ kind: "failed", code: "RELAY_REVERTED" });
      ttftStop(Date.now());
      setPhase({ kind: "done", creditUsd6: relay.creditUsd6 });
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
  }, [account.client, account.settings.faceId, address, starter]);

  return { phase, claim, ready: account.ready && address !== undefined };
}
