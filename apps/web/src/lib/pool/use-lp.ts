"use client";

/**
 * The pool's brain (flow book D1/D2; the phone's `useLp`): the vault snapshot + historical APR, utilisation (open
 * notional ÷ pool value from the live market books), and the sends — a deposit composed by `@senryo/query`
 * (`pool-deposit.ts`) from whatever pays for it (AUSD from the wallet then the trading account; on Mainnet any other
 * verified holding swapped to AUSD; Practice test USDC through the par swap, D-252), request redeem (a share of the
 * user's sLP) and claim. One reviewed deposit is one operation on the pool's trace: its network fee is planned on
 * Mainnet (B11), every leg shares its id, a failure after a finished leg stays visible as a partial outcome and nothing
 * is ever resent. Within the session's move cap an AUSD deposit signs in session; a swap leg or a deposit above the cap
 * asks for one passkey that signs every leg.
 */
import {
  addressOf,
  isDeployed,
  pinRead,
  poolTokenOf,
  readAccountSnapshot,
  readLpVault,
  type TxRequest,
} from "@senryo/chain";
import { type Address, notional, RISK } from "@senryo/core";
import {
  lpClaimRequest,
  lpRequestRedeemRequest,
  useAccountRisk,
  useLpApr,
  useLpVault,
  useMarkets,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { userSender } from "@/lib/account/sender";
import { type MoneyOperation, useMoneyOperation } from "@/lib/money/use-money-operation";
import { useEnsureGas } from "@/lib/trade/use-gas-top-up";
import { depositConfirmLevel } from "./confirm-level";

export function useLp() {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address as Address | undefined;
  const vault = useLpVault(address);
  const snapshot = known(vault);
  const trading = known(useAccountRisk(address, "latest"));
  const apr = useLpApr(snapshot?.totalAssets);
  const markets = useMarkets();
  const trace = useSendTrace(`pool:${env.chainId}:${address ?? "guest"}`);
  // The same trace key: a composed deposit's steps and a redeem/claim share the pool's one outcome surface.
  const runner = useMoneyOperation(`pool:${env.chainId}:${address ?? "guest"}`);
  const gas = useEnsureGas();
  const vaultAddress = isDeployed(env.chainId, "LpVault") ? addressOf(env.chainId, "LpVault") : undefined;

  const openNotional = markets.reduce((sum, m) => {
    const v = known(m.reading);
    return v ? sum + notional(v.book.longSize + v.book.shortSize, v.pv.price18) : sum;
  }, 0n);
  const utilisationBps =
    snapshot && snapshot.totalAssets > 0n ? (openNotional * RISK.BPS) / snapshot.totalAssets : undefined;

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

  /**
   * A reviewed deposit (`@senryo/query` pool-deposit.ts) as one operation: its network fee planned on Mainnet (B11),
   * then every step signed under one slide (and one passkey when it asks for one). Returns why it can't go, if so.
   */
  const deposit = async (op: MoneyOperation): Promise<string | undefined> => {
    const ready = await runner.prepare(op);
    if (!ready.ok) return ready.block;
    await runner.run(ready.op);
    return undefined;
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
    vaultAddress,
    runner,
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
