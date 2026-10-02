/**
 * The Perpl ticket's brain (flow book C4): margin (keypad text, usd6) × leverage → notional, sized to whole lots at the
 * IOC's bound (mark ± 0.5 %) from the live market terms; the liquidation estimate from Perpl's own formula; the
 * operation the account needs (`perplOpenOperation`: approve → createAccount | depositCollateral → IOC), re-planned
 * while the ticket is open; the first blocker; how it is confirmed (session, or one passkey above the session's
 * limits); and the send — the reviewed plan frozen at the slide and run as one operation (`usePerplRun`).
 */
import {
  perplLimitPrice,
  perplLotsFor,
  perplNotional,
  perplOpenLiquidationPrice,
  perplOrderRequest,
  perplTakerSide,
  readPerplAccount,
  readPerplExchange,
  readPerplMarketTerms,
  readPerplWalletCollateral,
  type TxRequest,
} from "@senryo/chain";
import { PERPL_FEE_DENOMINATOR, PERPL_SLIPPAGE_BPS } from "@senryo/config";
import { DECIMALS, formatUnits, parseUnits } from "@senryo/core";
import {
  mainnetReadOf,
  PERPL_TERMS_REFETCH_MS,
  perplOpenOperation,
  useGeo,
  usePerplAccount,
  usePerplExchange,
  usePerplMarketTerms,
  useQueryEnv,
} from "@senryo/query";
import { onlineManager, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyKey, type KeypadKey } from "~/components/trade/Keypad";
import { type Side, useTicketDraft } from "~/features/trade/draft";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { perplConfirmLevel } from "./confirm";
import { perplFeeShortWei } from "./fees";
import { leverageHdths, leverageX } from "./format";
import { PERPL_CHAIN, type PerplMarketMeta } from "./market";
import { usePerplRun } from "./usePerplRun";
import { type PerplBlock, stepLabel } from "./words";

const DEFAULT_LEVERAGE = 5;
/** The plan follows the typing once it pauses this long. */
const PLAN_DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
/** bps → millionths (fees are ppm since contract 1.7.5). */
const PPM_PER_BPS = 100n;
/** Max rounds down to whole cents (the keypad's precision). */
const CENT_USD6 = 10_000n;

export const perplTraceKey = (address: string | undefined, marketId: number) =>
  `perpl:${PERPL_CHAIN}:${address?.toLowerCase() ?? "guest"}:${marketId}`;

export function usePerplTicket(meta: PerplMarketMeta) {
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const address = account.hint?.address;
  const mainnet = network.chainId === PERPL_CHAIN;
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline());
  const termsReading = usePerplMarketTerms(meta.marketId);
  const terms = termsReading.status === "fresh" || termsReading.status === "stale" ? termsReading.value : undefined;
  const snapshotReading = usePerplAccount(address);
  const snapshot =
    snapshotReading.status === "fresh" || snapshotReading.status === "stale" ? snapshotReading.value : undefined;
  const exchange = usePerplExchange();
  const halted = exchange.status === "fresh" || exchange.status === "stale" ? exchange.value.halted : false;
  const geo = useGeo();
  const perplAllowed = geo.status === "fresh" || geo.status === "stale" ? geo.value.perplAllowed : true;
  const maxX = terms ? leverageX(terms.maxLeverageHdths) : undefined;

  const key = perplTraceKey(address, meta.marketId);
  const { draft, update } = useTicketDraft(key, { side: "long", amountText: "", leverage: DEFAULT_LEVERAGE });
  const { side, amountText } = draft;
  // The draft's default waits for the market's maximum: a 3× market never opens at 5×.
  const leverage = maxX === undefined ? draft.leverage : Math.max(1, Math.min(draft.leverage, maxX));
  const parsed = parseUnits(amountText === "" ? "0" : amountText, DECIMALS.usd6);
  const amountUsd6 = parsed.ok ? parsed.value : 0n;
  const notionalUsd6 = amountUsd6 * BigInt(leverage);
  const hdths = leverageHdths(leverage);

  // A preview from the live terms while the plan is read: whole lots at the IOC's bound.
  const previewLimit = terms
    ? perplLimitPrice(terms.markPNS, perplTakerSide("open", side), PERPL_SLIPPAGE_BPS)
    : undefined;
  const previewLots = terms && previewLimit ? perplLotsFor(notionalUsd6, previewLimit, terms) : 0n;
  const oneLotUsd6 = terms && previewLimit ? perplNotional(1n, previewLimit, terms) : 0n;
  const held = snapshot?.positions.find((p) => p.marketId === meta.marketId);
  const buyingPowerUsd6 = snapshot ? (snapshot.account?.availableCNS ?? 0n) + snapshot.wallet.balance : undefined;
  // Max: the margin whose order still fits what's on Perpl plus the wallet's AUSD after the fee and the slippage cushion.
  const cushionPpm = terms ? terms.takerFeePpm + PERPL_SLIPPAGE_BPS * PPM_PER_BPS : 0n;
  const maxRaw =
    buyingPowerUsd6 !== undefined
      ? (buyingPowerUsd6 * PERPL_FEE_DENOMINATOR) / (PERPL_FEE_DENOMINATOR + BigInt(leverage) * cushionPpm)
      : 0n;
  const maxAmountUsd6 = (maxRaw / CENT_USD6) * CENT_USD6;

  // The operation this account needs, re-planned from the chain while the ticket is open.
  const typed = `${side}:${notionalUsd6}:${hdths}`;
  const settledKey = useDebounced(typed, PLAN_DEBOUNCE_MS);
  const [plannedSide, plannedNotional, plannedHdths] = settledKey.split(":");
  const planned = {
    side: plannedSide === "short" ? ("short" as const) : ("long" as const),
    notional: BigInt(plannedNotional ?? "0"),
    hdths: BigInt(plannedHdths ?? "0"),
  };
  const planQuery = useQuery({
    queryKey: [
      "perpl",
      PERPL_CHAIN,
      "plan",
      address?.toLowerCase() ?? "",
      meta.marketId,
      planned.side,
      planned.notional.toString(),
      planned.hdths.toString(),
    ] as const,
    enabled: mainnet && address !== undefined && planned.notional > 0n,
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
    queryFn: async () => {
      const read = mainnetReadOf(env);
      const owner = address as NonNullable<typeof address>;
      const plan = await perplOpenOperation(read, owner, {
        marketId: meta.marketId,
        side: planned.side,
        notionalCNS: planned.notional,
        leverageHdths: planned.hdths,
      });
      return { plan, feeShortWei: await perplFeeShortWei(read, owner, plan.plannedActions) };
    },
  });
  const settledPlan =
    planQuery.data && settledKey === typed && planQuery.data.plan.reviewedIntent.side === side
      ? planQuery.data
      : undefined;
  const plan = settledPlan?.plan;
  // What the slide signs is the plan's own read (its terms, bound and lots); every number shown and recorded comes from
  // it once it's there, so the reviewed size, fee and liquidation describe exactly the order that is sent.
  const shownTerms = plan?.terms ?? terms;
  const limitPricePNS = plan ? plan.limitPricePNS : previewLimit;
  const lots = plan ? plan.lots : previewLots;
  const sizedUsd6 = shownTerms && limitPricePNS ? perplNotional(lots, limitPricePNS, shownTerms) : 0n;
  const feeUsd6 = shownTerms ? ceilDiv(sizedUsd6 * shownTerms.takerFeePpm, PERPL_FEE_DENOMINATOR) : 0n;
  const liqPricePNS =
    shownTerms && limitPricePNS && lots > 0n
      ? perplOpenLiquidationPrice({
          side,
          entryPricePNS: limitPricePNS,
          lots,
          leverageHdths: hdths,
          maintMarginFracHdths: shownTerms.maintMarginFracHdths,
          priceDecimals: shownTerms.priceDecimals,
          lotDecimals: shownTerms.lotDecimals,
        })
      : null;

  const opposite = held && held.side !== side ? held : undefined;
  const block: PerplBlock | undefined = !online
    ? { code: "offline" }
    : !mainnet
      ? { code: "practice" }
      : !perplAllowed
        ? { code: "region" }
        : !address
          ? { code: "guest" }
          : halted || plan?.blocker === "halted"
            ? { code: "halted" }
            : terms?.paused || plan?.blocker === "paused"
              ? { code: "paused" }
              : (snapshot?.account?.frozen ?? 0) !== 0 || plan?.blocker === "frozen"
                ? { code: "frozen" }
                : opposite
                  ? { code: "opposite", held: opposite }
                  : // The ruler and "Trade this" clamp to the market's maximum (C11); only a maximum lowered
                    // between reads can still refuse the leverage.
                    plan?.blocker === "leverage" && maxX !== undefined
                    ? { code: "leverage", maxX }
                    : amountUsd6 > 0n && terms && lots === 0n
                      ? { code: "size", minUsd6: ceilDiv(oneLotUsd6, BigInt(leverage)) }
                      : plan?.blocker === "wallet-short"
                        ? { code: "wallet-short", shortCNS: plan.walletShortCNS }
                        : settledPlan && settledPlan.feeShortWei > 0n
                          ? { code: "fees", shortWei: settledPlan.feeShortWei }
                          : undefined;

  // The requests the session would be asked to sign, the order built provisionally (the policy reads calldata).
  const requests: TxRequest[] =
    plan && !plan.blocker
      ? plan.steps.map((s) =>
          typeof s === "function"
            ? perplOrderRequest(PERPL_CHAIN, {
                marketId: meta.marketId,
                intent: "open",
                side,
                lots: plan.lots,
                limitPricePNS: plan.limitPricePNS,
                leverageHdths: hdths,
              })
            : s,
        )
      : [];
  const confirmWith = perplConfirmLevel({
    client: account.client,
    address,
    faceId: account.settings.faceId,
    requests,
    marketLabel: meta.name,
  });

  const runner = usePerplRun(key);
  const guard = useReviewGuard([PERPL_CHAIN, address, meta.marketId, side, amountText, leverage].join(":"));
  const checked = useRef(new Set<number>());

  const submit = async () => {
    const reviewed = plan;
    if (!reviewed || reviewed.blocker || !address || block) return undefined;
    const read = mainnetReadOf(env);
    checked.current = new Set();
    const firstOrderIndex = reviewed.steps.findIndex((s) => typeof s === "function");
    /** Before the first step and before the order: the venue, the market and the money are still as reviewed. */
    const revalidate = async (index: number) => {
      guard();
      if (checked.current.has(index) || (index !== 0 && index !== firstOrderIndex)) return;
      const [ex, market, acct, wallet] = await Promise.all([
        readPerplExchange(read, PERPL_CHAIN),
        readPerplMarketTerms(read, PERPL_CHAIN, meta.marketId),
        readPerplAccount(read, PERPL_CHAIN, address),
        readPerplWalletCollateral(read, PERPL_CHAIN, address),
      ]);
      if (ex.halted || market.paused) throw new Error("Perpl paused this market. Nothing was sent.");
      if (acct && acct.frozen !== 0) throw new Error("Perpl froze this account. Nothing was sent.");
      if (index === 0 && reviewed.depositCNS > 0n) {
        // The account appeared or vanished since review: the planned createAccount / deposit no longer fits.
        if ((acct === undefined) !== (reviewed.account === undefined)) throw new Error("Review this order again.");
        if (wallet.balance < reviewed.depositCNS) throw new Error("Not enough AUSD in your wallet now. Review again.");
      }
      if (index === firstOrderIndex && (acct?.availableCNS ?? 0n) < reviewed.marginCNS) {
        throw new Error("Not enough on Perpl for this order now. Review again.");
      }
      guard();
      checked.current.add(index);
    };
    return runner.run({
      plan: reviewed,
      labels: reviewed.plannedActions.map((a) => stepLabel(a, reviewed.depositCNS)),
      reviewedIntent: {
        ...reviewed.reviewedIntent,
        kind: "perpl",
        network: "mainnet",
        symbol: meta.symbol,
        name: meta.name,
        leverage: String(leverage),
        marginUsd6: amountUsd6.toString(),
        feeUsd6: feeUsd6.toString(),
        liqPricePNS: liqPricePNS === null ? "" : liqPricePNS.toString(),
      },
      confirmWith,
      marketLabel: meta.name,
      revalidate,
    });
  };

  return {
    meta,
    terms,
    termsReading,
    snapshot,
    side,
    setSide: (s: Side) => update({ side: s }),
    amountText,
    amountUsd6,
    onKey: (k: KeypadKey) => update((d) => ({ amountText: applyKey(d.amountText, k) })),
    setAmountUsd6: (v: bigint) =>
      update({ amountText: v === 0n ? "" : formatUnits(v, DECIMALS.usd6, DECIMALS.cents, { grouping: false }) }),
    leverage,
    maxX,
    setLeverage: (v: number) => update({ leverage: Math.max(1, Math.min(v, maxX ?? v)) }),
    notionalUsd6,
    maxAmountUsd6,
    sizedUsd6,
    lots,
    limitPricePNS,
    feeUsd6,
    liqPricePNS,
    held,
    buyingPowerUsd6,
    plan,
    planning: notionalUsd6 > 0n && mainnet && address !== undefined && !settledPlan && !planQuery.isError,
    /** Perpl's chain reads failed for this order (the query keeps retrying on its interval). */
    planFailed: !settledPlan && planQuery.isError,
    block,
    confirmWith,
    hasAccount: address !== undefined,
    ready: account.client !== undefined,
    runner,
    submit,
  };
}

export type PerplTicketModel = ReturnType<typeof usePerplTicket>;
