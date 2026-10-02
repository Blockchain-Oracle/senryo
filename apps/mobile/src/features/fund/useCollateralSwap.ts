/**
 * F26 collateral swap inside the account (mainnet only: the AUSD/USDC Uniswap v4 stable pool lives on 143), lifted
 * from the balance-details panel so the swap page and the panel share one path: the direction, the share of the
 * balance being swapped, the Quoter's quote with its minimum received, and `SenryoCore.swapCollateral` sent through the
 * scoped signer. The maths and the request are unchanged; the core re-checks `minOut` against what actually arrived.
 */
import { type AccountSnapshot, findStablePool, quoteExactIn, readAccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { RISK } from "@senryo/core";
import { COLLATERAL_TOKENS, swapCollateralRequest, useCollateralQuote, useQueryEnv, useSendTrace } from "@senryo/query";
import { useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { useReviewGuard } from "~/lib/review-guard";

export type SwapFrom = "usdc" | "ausd";

export function useCollateralSwap(snapshot: AccountSnapshot | undefined) {
  const env = useQueryEnv();
  const account = useAccount();
  const trace = useSendTrace(`collateral-swap:${env.chainId}:${account.hint?.address ?? "guest"}`);
  const [from, setFrom] = useState<SwapFrom>("usdc");
  const [shareBps, setShareBps] = useState<bigint>(RISK.BPS);
  const balance = snapshot ? (from === "usdc" ? snapshot.usdc : snapshot.ausd) : 0n;
  const amountIn = (balance * shareBps) / RISK.BPS;
  const quote = useCollateralQuote(COLLATERAL_TOKENS[from], amountIn);
  const q = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const guard = useReviewGuard([env.chainId, account.hint?.address, from, amountIn, q?.minOut].join(":"));
  const swap = async () => {
    const client = account.client;
    const address = account.hint?.address;
    if (!client || !address || !q || !snapshot) return;
    const sender = userSender(client, address, account.settings.faceId);
    await trace.run(sender, swapCollateralRequest(env.chainId, q, positionCount(snapshot.positionBitmap)), {
      reviewedIntent: {
        amount: q.amountIn.toString(),
        symbol: from.toUpperCase(),
        source: "trading",
        minOut: q.minOut.toString(),
      },
      revalidate: async () => {
        guard();
        const current = await readAccountSnapshot(env.read, env.chainId, address);
        const balance = from === "usdc" ? current.usdc : current.ausd;
        const pool = await findStablePool(env.read);
        if (!pool || q.amountIn > balance) throw new Error("The balance or route changed. Review the swap again.");
        const quote = await quoteExactIn(
          env.read,
          pool.key,
          pool.key.currency0.toLowerCase() === q.tokenIn.toLowerCase(),
          q.amountIn,
        );
        if (quote.amountOut < q.minOut) throw new Error("The quote changed. Review the swap again.");
        guard();
      },
    });
  };
  return {
    from,
    setFrom,
    shareBps,
    setShareBps,
    balance,
    amountIn,
    quote,
    q,
    trace,
    busy: trace.running,
    swapped: trace.events.some((e) => e.stage === "finalized"),
    ready: account.client !== undefined,
    swap,
  };
}
