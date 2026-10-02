"use client";

/**
 * The pool's brain (flow book D1/D2; the phone's `useLp`): the vault snapshot + historical APR, utilisation (open
 * notional ÷ pool value from the live market books), and the sends — a deposit composed from where the AUSD sits
 * (trading account → withdraw to self, then approve if needed, then deposit), request redeem (a share of the user's sLP)
 * and claim. One reviewed deposit is one operation: every leg shares its id and its trace, so a failure after a finished
 * leg stays visible as a partial outcome and nothing is ever resent. Within the session's move cap the legs sign in
 * session; above it one passkey step-up signs every leg.
 */
import {
  addressOf,
  isDeployed,
  pinRead,
  poolTokenOf,
  readAccountSnapshot,
  readLpVault,
  type Sender,
  type TxRequest,
} from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { type Address, notional, RISK } from "@senryo/core";
import {
  lpApproveRequest,
  lpClaimRequest,
  lpDepositRequest,
  lpRequestRedeemRequest,
  maxWithdrawable,
  useAccountRisk,
  useLpApr,
  useLpVault,
  useMarkets,
  useQueryEnv,
  useSendTrace,
  withdrawRequest,
} from "@senryo/query";
import { useStepUp } from "@/components/auth/step-up";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { stepUpSender, userSender } from "@/lib/account/sender";
import { money } from "@/lib/format";
import { useEnsureGas } from "@/lib/trade/use-gas-top-up";
import { depositConfirmLevel } from "./confirm-level";

/** Where a deposit's AUSD comes from: the wallet, or the trading account (withdrawn to self first). */
export type DepositSource = "wallet" | "trading";

export function useLp() {
  const env = useQueryEnv();
  const account = useAccount();
  const stepUp = useStepUp();
  const address = account.hint?.address as Address | undefined;
  const vault = useLpVault(address);
  const snapshot = known(vault);
  const trading = known(useAccountRisk(address, "latest"));
  const apr = useLpApr(snapshot?.totalAssets);
  const markets = useMarkets();
  const trace = useSendTrace(`pool:${env.chainId}:${address ?? "guest"}`);
  const gas = useEnsureGas();
  const vaultAddress = isDeployed(env.chainId, "LpVault") ? addressOf(env.chainId, "LpVault") : undefined;

  const openNotional = markets.reduce((sum, m) => {
    const v = known(m.reading);
    return v ? sum + notional(v.book.longSize + v.book.shortSize, v.pv.price18) : sum;
  }, 0n);
  const utilisationBps =
    snapshot && snapshot.totalAssets > 0n ? (openNotional * RISK.BPS) / snapshot.totalAssets : undefined;
  const available: Record<DepositSource, bigint> = {
    wallet: snapshot?.walletAusd ?? 0n,
    trading: trading ? maxWithdrawable(trading, "AUSD") : 0n,
  };

  const fresh = async () => {
    if (!address) throw new Error("Choose an account first.");
    const block = await env.read.getBlock({ blockTag: "latest" });
    const read = pinRead(env.read, block.number);
    const [pool, acct] = await Promise.all([
      readLpVault(read, env.chainId, address),
      readAccountSnapshot(read, env.chainId, address, "latest"),
    ]);
    return { pool, account: acct };
  };

  const confirmFor = (amountUsd6: bigint) =>
    depositConfirmLevel({
      client: account.client,
      address,
      faceId: account.settings.faceId,
      amountUsd6,
      vault: vaultAddress,
      token: poolTokenOf(env.chainId),
      needsApproval: snapshot !== undefined && snapshot.allowance < amountUsd6,
    });

  /** Runs `legs` with the session signer, or inside one passkey step-up; a cancelled passkey is silent. */
  const sign = async (passkey: boolean, amountUsd6: bigint, legs: (sender: Sender) => Promise<unknown>) => {
    const client = account.client;
    if (!client || !address) return;
    if (!passkey) {
      await legs(userSender(client, address, account.settings.faceId));
      return;
    }
    await stepUp.confirm(
      {
        title: `Deposit ${money(amountUsd6)} into the pool`,
        detail: "Above this session’s limits. One passkey signs every step.",
        confirmLabel: "Deposit with passkey",
      },
      () => account.stepUp((signer) => legs(stepUpSender(signer))),
    );
  };

  const deposit = async (amountUsd6: bigint, source: DepositSource, guard: () => void) => {
    if (!snapshot || !trading || !address || !vaultAddress || amountUsd6 <= 0n) return;
    const fromTrading = source === "trading";
    const needsApproval = snapshot.allowance < amountUsd6;
    const planned = [...(fromTrading ? ["withdraw"] : []), ...(needsApproval ? ["approve"] : []), "lpDeposit"];
    const intent = { amount: amountUsd6.toString(), source, destination: "pool", symbol: "AUSD" };
    const positions = positionCount(trading.positionBitmap);
    // Each leg re-reads the chain right before it signs: the pool's room and the AUSD it needs must still be there.
    const validate = (stage: "start" | "wallet") => async () => {
      guard();
      const now = await fresh();
      const short =
        stage === "start" && fromTrading
          ? amountUsd6 > maxWithdrawable(now.account, "AUSD")
          : amountUsd6 > now.pool.walletAusd;
      if (short || amountUsd6 > now.pool.maxDeposit)
        throw new Error("The pool capacity or your balance changed. Review again.");
      guard();
    };
    await sign(confirmFor(amountUsd6) === "passkey", amountUsd6, async (sender) => {
      let operationId: string | undefined;
      const step = async (request: TxRequest, stage: "start" | "wallet") => {
        const first = operationId === undefined;
        const result = await trace.run(sender, request, {
          preflight: gas.preflight(request),
          revalidate: validate(stage),
          ...(first ? { plannedActions: planned, reviewedIntent: intent } : { operationId }),
        });
        operationId = result?.operationId ?? operationId;
        return result?.final?.stage === "finalized";
      };
      if (fromTrading && !(await step(withdrawRequest(env.chainId, "AUSD", amountUsd6, address, positions), "start")))
        return;
      const walletStage = fromTrading ? "wallet" : "start";
      if (needsApproval && !(await step(lpApproveRequest(env.chainId, vaultAddress, amountUsd6), walletStage))) return;
      await step(lpDepositRequest(env.chainId, amountUsd6, address), walletStage);
    });
  };

  const run = async (
    request: TxRequest,
    validate: (() => Promise<void>) | undefined,
    intent: Record<string, string>,
  ) => {
    const client = account.client;
    if (!client || !address) return undefined;
    return trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
      revalidate: validate,
      reviewedIntent: intent,
    });
  };

  return {
    address,
    vault,
    snapshot,
    trading,
    available,
    apr,
    utilisationBps,
    trace,
    confirmFor,
    deposit,
    requestRedeem: (shares: bigint, guard: () => void) =>
      address
        ? run(
            lpRequestRedeemRequest(env.chainId, shares, address),
            async () => {
              guard();
              const now = await fresh();
              if (shares <= 0n || shares > now.pool.shares) throw new Error("Your pool shares changed. Review again.");
              guard();
            },
            { shares: shares.toString(), source: "pool", destination: "redemption escrow" },
          )
        : undefined,
    claim: (requestId: bigint) =>
      run(lpClaimRequest(env.chainId, requestId), undefined, {
        requestId: requestId.toString(),
        source: "redemption escrow",
        destination: "wallet",
      }),
    ready: account.client !== undefined,
  };
}

export type Lp = ReturnType<typeof useLp>;

/** A share count's value at the pool's conservative price. */
export const sharesValueOf = (shares: bigint, pool: { totalSupply: bigint; totalAssets: bigint }) =>
  pool.totalSupply > 0n ? (shares * pool.totalAssets) / pool.totalSupply : 0n;
