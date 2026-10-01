/**
 * Redeeming a voucher code (StarterDrip `redeemVoucher`, D-143): the account signs the `Voucher` typed data with its
 * scoped session (no prompt while unlocked), the sponsor relays it, and the phase follows the relay until it is
 * finalized. A signed voucher is never re-sent by itself: a failure names its cause and the user decides.
 */
import { classifyAuthError, isSilent, signVoucher } from "@senryo/account";
import { keys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { policyContext } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { isTerminal, StarterError, type StarterErrorCode, starter } from "~/lib/account/starter";
import { RELAY_POLL_MAX, RELAY_POLL_MS } from "~/lib/constants/auth";

export type VoucherPhase =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; creditUsd6: bigint }
  | { kind: "failed"; code: StarterErrorCode | "AUTH" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useVoucher() {
  const account = useAccount();
  const env = useQueryEnv();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  const [phase, setPhase] = useState<VoucherPhase>({ kind: "idle" });

  const redeem = useCallback(
    async (code: string) => {
      const client = account.client;
      if (!client || !address) return;
      setPhase({ kind: "working" });
      try {
        const signer = client.signer(policyContext(address, account.settings.faceId));
        let relay = await starter.voucher(await signVoucher(signer, env.chainId, code, Date.now()));
        for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i += 1) {
          await sleep(RELAY_POLL_MS);
          relay = await starter.relay(relay.relayId);
        }
        await queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) });
        if (relay.stage !== "finalized") return setPhase({ kind: "failed", code: "RELAY_REVERTED" });
        setPhase({ kind: "done", creditUsd6: relay.creditUsd6 });
      } catch (error) {
        if (error instanceof StarterError) return setPhase({ kind: "failed", code: error.code });
        const kind = classifyAuthError(error);
        setPhase(isSilent(kind) ? { kind: "idle" } : { kind: "failed", code: "AUTH" });
      }
    },
    [account.client, account.settings.faceId, address, env.chainId, queryClient],
  );

  return { phase, redeem, reset: () => setPhase({ kind: "idle" }) };
}
