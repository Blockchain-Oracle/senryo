/**
 * F26 collateral swap inside the account (mainnet only: the AUSD/USDC Uniswap v4 stable pool lives on 143), lifted
 * from the balance-details panel so the swap page and the panel share one path: the direction, the share of the
 * balance being swapped, the Quoter's quote with its minimum received, and `SenryoCore.swapCollateral` sent through the
 * scoped signer. The maths and the request are unchanged; the core re-checks `minOut` against what actually arrived.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { RISK } from "@senryo/core";
import { COLLATERAL_TOKENS, swapCollateralRequest, useCollateralQuote, useQueryEnv, useSendTrace } from "@senryo/query";
import { useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";

export type SwapFrom = "usdc" | "ausd";

export function useCollateralSwap(snapshot: AccountSnapshot | undefined) {
  const env = useQueryEnv();
  const account = useAccount();
  const trace = useSendTrace();
  const [from, setFrom] = useState<SwapFrom>("usdc");
  const [shareBps, setShareBps] = useState<bigint>(RISK.BPS);
  const balance = snapshot ? (from === "usdc" ? snapshot.usdc : snapshot.ausd) : 0n;
  const amountIn = (balance * shareBps) / RISK.BPS;
  const quote = useCollateralQuote(COLLATERAL_TOKENS[from], amountIn);
  const q = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const swap = async () => {
    const client = account.client;
    const address = account.hint?.address;
    if (!client || !address || !q || !snapshot) return;
    const sender = userSender(client, address, account.settings.faceId);
    await trace.run(sender, swapCollateralRequest(env.chainId, q, positionCount(snapshot.positionBitmap)));
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
