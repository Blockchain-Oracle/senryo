/**
 * Redeeming a voucher code (StarterDrip `redeemVoucher`, D-143): the account signs the `Voucher` typed data with its
 * scoped session (no prompt while unlocked), the sponsor relays it, and the phase follows the relay until it is
 * finalized. A signed voucher is never re-sent by itself: a failure names its cause and the user decides.
 */
import { classifyAuthError, isSilent, signVoucher } from "@senryo/account";
import { assertOperationScope, keys, operationKey, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { policyContext } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import {
  relayNotSent,
  relayOperation,
  relayProgress,
  relaySubmitted,
  restoredRelay,
} from "~/lib/account/relay-operation";
import { isTerminal, type RelayResult, StarterError, type StarterErrorCode, starter } from "~/lib/account/starter";
import { RELAY_POLL_MAX, RELAY_POLL_MS } from "~/lib/constants/auth";
import { useReviewGuard } from "~/lib/review-guard";

export type VoucherPhase =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "pending" }
  | { kind: "done"; creditUsd6: bigint }
  | { kind: "failed"; code: StarterErrorCode | "AUTH" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useVoucher() {
  const account = useAccount();
  const env = useQueryEnv();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  const guard = useReviewGuard([env.chainId, address].join(":"));
  const [phase, setPhase] = useState<VoucherPhase>({ kind: "idle" });

  useEffect(() => {
    if (!address) return;
    const previous = restoredRelay(operationKey(env.chainId, address, "relay-voucher"));
    setPhase(
      previous?.outcome === "pending" || previous?.outcome === "preparing" ? { kind: "pending" } : { kind: "idle" },
    );
  }, [address, env.chainId]);

  const redeem = useCallback(
    async (code: string, validateInput: () => void) => {
      const client = account.client;
      if (!client || !address) return;
      setPhase({ kind: "working" });
      const existing = restoredRelay(operationKey(env.chainId, address, "relay-voucher"));
      const recovering = existing?.outcome === "pending" || existing?.outcome === "preparing";
      const record = recovering ? existing : relayOperation(env, address, "voucher");
      let submitted = recovering;
      try {
        const signer = client.signer(policyContext(address, account.settings.faceId));
        let relay: RelayResult;
        if (recovering) {
          const id = record.steps[0]?.request?.relayId;
          const latest = id ? await starter.relay(id) : (await starter.status(env.chainId, address)).lastRelay;
          if (latest?.kind !== "voucher" || Date.parse(latest.createdAt) < record.createdAt)
            return setPhase({ kind: "pending" });
          relay = latest;
        } else {
          guard();
          validateInput();
          assertOperationScope(env.chainId, address);
          const signed = await signVoucher(signer, env.chainId, code, Date.now());
          guard();
          validateInput();
          assertOperationScope(env.chainId, address);
          relaySubmitted(record);
          submitted = true;
          relay = await starter.voucher(signed);
        }
        await relayProgress(env, record, relay, !recovering);
        for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i += 1) {
          await sleep(RELAY_POLL_MS);
          relay = await starter.relay(relay.relayId);
        }
        await queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) });
        const progress = await relayProgress(env, record, relay, !recovering);
        if (!isTerminal(relay) || progress.outcome === "pending") return setPhase({ kind: "pending" });
        if (relay.stage !== "finalized") return setPhase({ kind: "failed", code: "RELAY_REVERTED" });
        setPhase({ kind: "done", creditUsd6: relay.creditUsd6 });
      } catch (error) {
        if (
          !submitted ||
          (error instanceof StarterError && !["UNREACHABLE", "RELAYER_BUSY", "UNKNOWN"].includes(error.code))
        )
          relayNotSent(record);
        if (
          submitted &&
          !(error instanceof StarterError && !["UNREACHABLE", "RELAYER_BUSY", "UNKNOWN"].includes(error.code))
        )
          return setPhase({ kind: "pending" });
        if (error instanceof StarterError) return setPhase({ kind: "failed", code: error.code });
        const kind = classifyAuthError(error);
        setPhase(isSilent(kind) ? { kind: "idle" } : { kind: "failed", code: "AUTH" });
      }
    },
    [account.client, account.settings.faceId, address, env, queryClient, guard],
  );

  return { phase, redeem, reset: () => setPhase({ kind: "idle" }) };
}
