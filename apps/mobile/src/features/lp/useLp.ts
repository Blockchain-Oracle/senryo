/**
 * F24/F25 LP brain: the vault snapshot + historical APR, utilisation (open notional ÷ pool value from the live market
 * books), and the sends — practice faucet, approve-if-needed + deposit, request redeem (a share of the user's sLP),
 * claim — each through the scoped signer (LpVault is in scope) with the trace of the step in flight.
 */

import { addressOf, pinRead, readLpVault, type TxRequest } from "@senryo/chain";
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
import { stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { usd } from "~/lib/money";

export type LpStep = "faucet" | "approve" | "deposit" | "redeem" | "claim";

export function useLp() {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address as Address | undefined;
  const vault = useLpVault(address);
  const snapshot = vault.status === "fresh" || vault.status === "stale" ? vault.value : undefined;
  const apr = useLpApr(snapshot?.totalAssets);
  const markets = useMarkets();
  const trace = useSendTrace(`pool:${env.chainId}:${address ?? "guest"}`);
  const gas = useEnsureGas();

  const openNotional = markets.reduce((sum, m) => {
    if (m.reading.status !== "fresh" && m.reading.status !== "stale") return sum;
    const v = m.reading.value;
    return sum + notional(v.book.longSize + v.book.shortSize, v.pv.price18);
  }, 0n);
  const utilisationBps =
    snapshot && snapshot.totalAssets > 0n ? (openNotional * RISK.BPS) / snapshot.totalAssets : undefined;

  const run = async (
    build: (from: Address) => TxRequest,
    validate?: () => Promise<void> | void,
    intent?: Record<string, string>,
  ) => {
    const client = account.client;
    if (!client || !address) return undefined;
    const request = build(address);
    return trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
      revalidate: validate,
      reviewedIntent: intent,
    });
  };

  const fresh = async () => {
    if (!address) throw new Error("Choose an account first.");
    const block = await env.read.getBlock({ blockTag: "latest" });
    return readLpVault(pinRead(env.read, block.number), env.chainId, address);
  };
  const deposit = async (amountUsd6: bigint, guard: () => void) => {
    if (!snapshot || amountUsd6 <= 0n) return;
    const validate = async () => {
      guard();
      const current = await fresh();
      if (amountUsd6 > current.walletAusd || amountUsd6 > current.maxDeposit)
        throw new Error("The pool capacity or wallet balance changed. Review again.");
      guard();
    };
    const intent = { amount: amountUsd6.toString(), source: "wallet", destination: "pool", symbol: "AUSD" };
    if (snapshot.allowance < amountUsd6) {
      if (!address || !account.client) return;
      await requestStepUp(
        {
          title: `Deposit ${usd(amountUsd6)} into the pool`,
          detail:
            "Approve this amount of wallet AUSD, then deposit. Pool capital is at risk; redemptions wait 24 hours and market opening.",
          confirmLabel: "Confirm with passkey",
        },
        () =>
          account.stepUp(async (signer) => {
            const sender = stepUpSender(signer);
            const approval = lpApproveRequest(env.chainId, addressOf(env.chainId, "LpVault"), amountUsd6);
            const approved = await trace.run(sender, approval, {
              preflight: gas.preflight(approval),
              revalidate: validate,
              plannedActions: ["approve", "lpDeposit"],
              reviewedIntent: intent,
            });
            if (approved?.final?.stage !== "finalized") return;
            const deposit = lpDepositRequest(env.chainId, amountUsd6, address);
            await trace.run(sender, deposit, {
              preflight: gas.preflight(deposit),
              revalidate: validate,
              operationId: approved.operationId,
            });
          }),
      );
    } else await run((from) => lpDepositRequest(env.chainId, amountUsd6, from), validate, intent);
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
    requestRedeem: (shares: bigint, guard: () => void) =>
      run(
        (from) => lpRequestRedeemRequest(env.chainId, shares, from),
        async () => {
          guard();
          const current = await fresh();
          if (shares <= 0n || shares > current.shares) throw new Error("Your pool shares changed. Review again.");
          guard();
        },
        { shares: shares.toString(), source: "pool", destination: "redemption escrow" },
      ),
    claim: (requestId: bigint) =>
      run(() => lpClaimRequest(env.chainId, requestId), undefined, {
        requestId: requestId.toString(),
        source: "redemption escrow",
        destination: "wallet",
      }),
    ready: account.client !== undefined,
  };
}
