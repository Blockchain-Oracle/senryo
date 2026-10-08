/**
 * A held Perpl position (flow book C5 for Perpl): the position as the Exchange reports it (lots, entry, collateral,
 * PnL at the mark and its funding part), its liquidation price from Perpl's own formula, what's free on the account,
 * and a reduce / close — a reduce-only IOC on the other side (`perplCloseOperation`, `CloseLong` / `CloseShort`),
 * re-planned while the page is open, frozen at the slide and run as one operation. Closing is never session-capped.
 */
import {
  perplLiquidationPrice,
  perplNotional,
  readPerplAccount,
  readPerplMarketTerms,
  readPerplPositions,
} from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, PERPL_FEE_DENOMINATOR } from "@senryo/config";
import { BPS_DENOMINATOR, divRound, formatUnits } from "@senryo/core";
import {
  PERPL_TERMS_REFETCH_MS,
  perplCloseOperation,
  perplPnlAtMark,
  perplReadOf,
  usePerplAccount,
  usePerplLivePrice,
  usePerplMarketTerms,
  useQueryEnv,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { REDUCE_ALL_BPS } from "~/features/positions/constants";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { perplFeeReview } from "./fees";
import type { PerplMarketMeta } from "./market";
import { usePerplRun } from "./usePerplRun";

const MS_PER_SECOND = 1000;
const LIVE_MAX_AGE_MS = 30_000;
const E18 = 18;
const DECIMAL_BASE = 10n;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export const perplPositionTraceKey = (
  address: string | undefined,
  marketId: number,
  chainId: ChainId = MAINNET_CHAIN_ID,
) => `perpl-position:${chainId}:${address?.toLowerCase() ?? "guest"}:${marketId}`;

export function usePerplPosition(meta: PerplMarketMeta) {
  const env = useQueryEnv();
  const chainId = meta.chainId;
  const live = usePerplLivePrice(meta.marketId);
  const network = useNetwork();
  const account = useAccount();
  const address = account.hint?.address;
  const snapshotReading = usePerplAccount(address);
  const snapshot =
    snapshotReading.status === "fresh" || snapshotReading.status === "stale" ? snapshotReading.value : undefined;
  const termsReading = usePerplMarketTerms(meta.marketId);
  const terms = termsReading.status === "fresh" || termsReading.status === "stale" ? termsReading.value : undefined;
  const storedPosition = snapshot?.positions.find((p) => p.marketId === meta.marketId);
  const freshMark =
    live && terms && live.at >= terms.markTimestamp * MS_PER_SECOND && Date.now() - live.at < LIVE_MAX_AGE_MS
      ? live.price18 / DECIMAL_BASE ** BigInt(E18 - meta.priceDecimals)
      : undefined;
  const livePnl =
    storedPosition && freshMark !== undefined ? perplPnlAtMark(storedPosition, freshMark, meta) : undefined;
  const position =
    storedPosition && livePnl !== undefined
      ? {
          ...storedPosition,
          pnlCNS: livePnl,
          deltaPnlCNS: livePnl - storedPosition.premiumPnlCNS,
          markPricePNS: freshMark ?? storedPosition.markPricePNS,
        }
      : storedPosition;
  const [shareBps, setShareBps] = useState<bigint>(REDUCE_ALL_BPS);
  const closingAll = shareBps >= REDUCE_ALL_BPS;

  const liqPricePNS =
    position && terms
      ? perplLiquidationPrice({
          side: position.side,
          entryPricePNS: position.entryPricePNS,
          lots: position.lots,
          depositCNS: position.depositCNS,
          premiumPnlCNS: position.premiumPnlCNS,
          maintMarginFracHdths: terms.maintMarginFracHdths,
          priceDecimals: meta.priceDecimals,
          lotDecimals: meta.lotDecimals,
        })
      : null;
  const entryNotional = position ? perplNotional(position.lots, position.entryPricePNS, meta) : 0n;
  /** Leverage the position carries: entry notional over its collateral (isolated margin). */
  const LEVERAGE_SCALE = 100n;
  const LEVERAGE_DECIMALS = 2;
  const leverageText =
    position && position.depositCNS > 0n
      ? formatUnits(divRound(entryNotional * LEVERAGE_SCALE, position.depositCNS), LEVERAGE_DECIMALS, LEVERAGE_DECIMALS)
      : undefined;

  const plan = useQuery({
    queryKey: ["perpl", chainId, "close-plan", address?.toLowerCase() ?? "", meta.marketId, shareBps.toString()],
    enabled: address !== undefined && position !== undefined && network.chainId === chainId,
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
    queryFn: async () => {
      const read = perplReadOf(env);
      const owner = address as NonNullable<typeof address>;
      const closing = await perplCloseOperation(read, owner, { chainId, marketId: meta.marketId, shareBps });
      return { plan: closing, ...(await perplFeeReview(read, owner, closing.plannedActions)) };
    },
  });
  // The plan answers for the share on screen only: a full close sends the exact size, a share rounds down to lots.
  const expectedLots = position ? (closingAll ? position.lots : (position.lots * shareBps) / BPS_DENOMINATOR) : 0n;
  const reviewed = plan.data && plan.data.plan.lots === expectedLots ? plan.data.plan : undefined;
  /** MON missing for the close's network fee (closing never needs a passkey, but it does need MON). */
  const feeShortWei = reviewed ? (plan.data?.feeShortWei ?? 0n) : 0n;
  // The quote for this share: exit bound, its fee, and the share of the Exchange's own unrealized PnL it realises.
  const lots = reviewed?.lots ?? 0n;
  const exitNotional = reviewed && terms ? perplNotional(lots, reviewed.limitPricePNS, meta) : 0n;
  const feeUsd6 = terms ? ceilDiv(exitNotional * terms.takerFeePpm, PERPL_FEE_DENOMINATOR) : 0n;
  const realizedUsd6 = position && position.lots > 0n ? (position.pnlCNS * lots) / position.lots : 0n;

  const runner = usePerplRun(perplPositionTraceKey(address, meta.marketId, chainId));
  const guard = useReviewGuard([chainId, address, meta.marketId, shareBps, position?.lots].join(":"));

  const submit = async () => {
    const frozen = reviewed;
    if (!frozen || frozen.blocker || !address || !position || plan.isFetching || plan.isError || !plan.data)
      return undefined;
    const read = perplReadOf(env);
    let checked = false;
    return runner.run({
      plan: frozen,
      reviewedNetworkFeesWei: plan.data.feeBoundsWei,
      labels: [closingAll ? "Close" : "Reduce"],
      reviewedIntent: {
        ...frozen.reviewedIntent,
        kind: "perpl",
        network: network.key,
        symbol: meta.symbol,
        name: meta.name,
        shareBps: shareBps.toString(),
        closingAll: String(closingAll),
        feeUsd6: feeUsd6.toString(),
        realizedUsd6: realizedUsd6.toString(),
      },
      // Reduce-only orders are never capped by the session (policy §3): the session signs them.
      confirmWith: "session",
      marketLabel: meta.name,
      // The chain is re-read once, before the first signature; later calls (around the signature, right before
      // the order's window is checked) only re-check that the reviewed screen is still the one on show.
      revalidate: async () => {
        guard();
        if (checked) return;
        const [acct, market] = await Promise.all([
          readPerplAccount(read, chainId, address),
          readPerplMarketTerms(read, chainId, meta.marketId),
        ]);
        const [now] = acct ? await readPerplPositions(read, chainId, acct.accountId, [meta.marketId]) : [];
        // A full close must close exactly what was reviewed: a grown position would leave exposure open.
        const changed = closingAll ? now?.lots !== frozen.lots : (now?.lots ?? 0n) < frozen.lots;
        if (!now || now.side !== position.side || changed) throw new Error("The position changed. Review it again.");
        if (market.paused) throw new Error(`${meta.symbol} is paused on Perpl. Nothing was sent.`);
        guard();
        checked = true;
      },
    });
  };

  return {
    loading: snapshotReading.status === "unknown",
    failed: snapshotReading.status === "failed" ? snapshotReading.error : undefined,
    snapshot,
    terms,
    position,
    liqPricePNS,
    leverageText,
    entryNotional,
    shareBps,
    setShareBps,
    closingAll,
    plan: reviewed,
    feeShortWei,
    planning: position !== undefined && reviewed === undefined && !plan.isError,
    lots,
    feeUsd6,
    realizedUsd6,
    runner,
    submit,
    networkFeeWei: plan.data?.networkFeeWei,
    feeBlock: plan.isError ? "Network fee check failed. Review again." : undefined,
    feeBusy: plan.isFetching,
    ready: !plan.isFetching && !plan.isError && account.client !== undefined && network.chainId === chainId,
  };
}

export type PerplPositionModel = ReturnType<typeof usePerplPosition>;
