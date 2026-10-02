"use client";

/**
 * Redeeming a voucher code (StarterDrip `redeemVoucher`, D-143; the phone's `useVoucher`): the account signs the
 * `Voucher` typed data with its scoped session (no prompt while unlocked), the sponsor relays it, and the phase
 * follows the relay until it is finalized. A submitted voucher is never re-sent by itself: a transport failure after
 * submission is "pending" (the relay may still run it) and the status read settles it; a refusal names its cause.
 */
import { classifyAuthError, isSilent, signVoucher } from "@senryo/account";
import { keys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { RELAY_POLL_MAX, RELAY_POLL_MS } from "@/lib/constants/auth";
import { policyContext } from "./api";
import { useAccount } from "./provider";
import { isTerminal, type RelayResult, StarterError, type StarterErrorCode, starter } from "./starter";

export type VoucherPhase =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "pending" }
  | { kind: "done"; creditUsd6: bigint }
  | { kind: "failed"; code: StarterErrorCode | "AUTH" | "FORMAT" };

/** Transport-level failures after submission: the relay may still have it. */
const UNSURE: ReadonlySet<StarterErrorCode> = new Set<StarterErrorCode>(["UNREACHABLE", "RELAYER_BUSY", "UNKNOWN"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useVoucher() {
  const account = useAccount();
  const env = useQueryEnv();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  const [phase, setPhase] = useState<VoucherPhase>({ kind: "idle" });

  const follow = useCallback(
    async (first: RelayResult) => {
      let relay = first;
      for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i += 1) {
        await sleep(RELAY_POLL_MS);
        relay = await starter.relay(relay.relayId);
      }
      if (address) await queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) });
      if (!isTerminal(relay)) return setPhase({ kind: "pending" });
      if (relay.stage !== "finalized") return setPhase({ kind: "failed", code: "RELAY_REVERTED" });
      setPhase({ kind: "done", creditUsd6: relay.creditUsd6 });
    },
    [address, env.chainId, queryClient],
  );

  /** A voucher relay still running from before a reload is followed, never re-signed. */
  const check = useCallback(async () => {
    if (!address) return;
    const status = await starter.status(env.chainId, address).catch(() => undefined);
    const last = status?.lastRelay;
    if (last?.kind === "voucher" && !isTerminal(last)) {
      setPhase({ kind: "working" });
      await follow(last).catch(() => setPhase({ kind: "pending" }));
    }
  }, [address, env.chainId, follow]);

  useEffect(() => {
    void check();
  }, [check]);

  const redeem = useCallback(
    async (code: string) => {
      const client = account.client;
      if (!client || !address) return;
      setPhase({ kind: "working" });
      let submitted = false;
      try {
        const signer = client.signer(policyContext(address, account.settings.faceId));
        const signed = await signVoucher(signer, env.chainId, code, Date.now());
        submitted = true;
        await follow(await starter.voucher(signed));
      } catch (error) {
        if (error instanceof RangeError) return setPhase({ kind: "failed", code: "FORMAT" });
        if (error instanceof StarterError) {
          if (submitted && UNSURE.has(error.code)) return setPhase({ kind: "pending" });
          return setPhase({ kind: "failed", code: error.code });
        }
        if (submitted) return setPhase({ kind: "pending" });
        const kind = classifyAuthError(error);
        setPhase(isSilent(kind) ? { kind: "idle" } : { kind: "failed", code: "AUTH" });
      }
    },
    [account.client, account.settings.faceId, address, env.chainId, follow],
  );

  return { phase, redeem, check, reset: () => setPhase({ kind: "idle" }) };
}
