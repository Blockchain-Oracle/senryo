/**
 * F24/F25 LP brain: the vault snapshot + historical APR, utilisation (open notional ÷ pool value from the live market
 * books), and the sends — practice faucet, approve-if-needed + deposit, request redeem (a share of the user's sLP),
 * claim — each through the scoped signer (LpVault is in scope) with the trace of the step in flight.
 */

import { addressOf } from "@senryo/chain";
import { type Address, notional, RISK } from "@senryo/core";
import {
  lpApproveRequest,
  lpClaimRequest,
  lpDepositRequest,
  lpRequestRedeemRequest,
  practiceFaucetRequest,
  useLpApr,
  useLpVault,
  useMarkets,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";

export type LpStep = "faucet" | "approve" | "deposit" | "redeem" | "claim";

export function useLp() {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address as Address | undefined;
  const vault = useLpVault(address);
  const snapshot = vault.status === "fresh" || vault.status === "stale" ? vault.value : undefined;
  const apr = useLpApr(snapshot?.totalAssets);
  const markets = useMarkets();
  const trace = useSendTrace();
  const gas = useEnsureGas();

  const openNotional = markets.reduce((sum, m) => {
    if (m.reading.status !== "fresh" && m.reading.status !== "stale") return sum;
    const v = m.reading.value;
    return sum + notional(v.book.longSize + v.book.shortSize, v.pv.price18);
  }, 0n);
  const utilisationBps =
    snapshot && snapshot.totalAssets > 0n ? (openNotional * RISK.BPS) / snapshot.totalAssets : undefined;

  const run = async (build: (from: Address) => Parameters<typeof trace.run>[1]) => {
    const client = account.client;
    if (!client || !address) return undefined;
    const request = build(address);
    return trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
    });
  };

  const deposit = async (amountUsd6: bigint) => {
    if (!snapshot || amountUsd6 <= 0n) return;
    if (snapshot.allowance < amountUsd6) {
      const approved = await run(() => lpApproveRequest(env.chainId, addressOf(env.chainId, "LpVault"), amountUsd6));
      if (approved?.final?.stage !== "finalized") return;
    }
    await run((from) => lpDepositRequest(env.chainId, amountUsd6, from));
  };

  return {
    address,
    vault,
    snapshot,
    apr,
    utilisationBps,
    trace,
    faucet: () => run(() => practiceFaucetRequest(env.chainId)),
    deposit,
    requestRedeem: (shareBps: bigint) =>
      snapshot && snapshot.shares > 0n
        ? run((from) => lpRequestRedeemRequest(env.chainId, (snapshot.shares * shareBps) / RISK.BPS, from))
        : undefined,
    claim: (requestId: bigint) => run(() => lpClaimRequest(env.chainId, requestId)),
    ready: account.client !== undefined,
  };
}
