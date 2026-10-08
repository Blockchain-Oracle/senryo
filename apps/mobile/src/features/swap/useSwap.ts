/**
 * Swap any ↔ any (B6, routes.md §2): what is paid (any holding — an unverified token sells only, warned), what is
 * received (any verified token), the exact amount, the live best-of quote (Monorail · KyberSwap, pinned routers) and
 * what stops it, in the order checked. "Review" freezes the quote and builds the sends ([network fee]? → [pull from
 * trades]? → [approve exact]? → swap) with the fee planned (B11; defect 12: MON short → "~$0.50 → MON" first); the slide signs them under one step-up, and the
 * swap's calldata is re-quoted the moment before signing — accepted only if it still gives the reviewed minimum
 * through the same router (order-book routes go stale within blocks). In Practice, test AUSD ↔ test USDC swaps at par
 * through PracticeSwap (D-252: no aggregator call, nothing to re-quote); every other Practice pair stays locked.
 */
import { type SwapQuoteOk, swapQuoteRoute } from "@senryo/api-client";
import { erc20Abi, isDeployed, MonReserveError, PracticeSwapFloatError, readAccountSnapshot } from "@senryo/chain";
import { GAS_LIMITS, NATIVE_TOKEN } from "@senryo/config";
import {
  aggregatorSwapRequests,
  maxWithdrawable,
  operationFeeNeed,
  practiceSwapLeg,
  useAccountRisk,
  useQueryEnv,
  userFeeCache,
  useSwapQuote,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAmountInput } from "~/features/money/amount";
import { MON_RESERVE_WEI, type MoneyAsset, spendableOf } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { pullToSelfStep } from "~/features/money/requests";
import { pegPriceUsd18, useMoneyAssets } from "~/features/money/useMoneyAssets";
import { type MoneyOperation, type PlannedStep, useMoneyOperation } from "~/features/money/useMoneyOperation";
import { useTokenList } from "~/features/money/useTokenList";
import { useAccount } from "~/lib/account/provider";
import { UNLOCK_WORD } from "~/lib/constants/auth";
import { useReviewGuard } from "~/lib/review-guard";
import { isParPair, PRACTICE_SWAP_ROUTE, parCounterpart, parReceivables, parStepUp } from "./practice";
import { nativeMon, receiveCandidates } from "./swap-assets";
import { swapProviderName } from "./swap-format";

/** The quote follows the typing once it pauses this long. */
const QUOTE_DEBOUNCE_MS = 350;
const FEE_STALE_MS = 15_000;

export type SwapBlock =
  | "account"
  | "empty"
  | "short"
  | "quoting"
  | "unsupported"
  | "no-route"
  | "failed"
  | "impact"
  | "unverified-receive";

export interface ReviewedSwap {
  pay: MoneyAsset;
  receive: MoneyAsset;
  amount: bigint;
  /** The frozen aggregator quote; absent for the Practice par swap, whose output is the amount itself (D-252). */
  quote: SwapQuoteOk | undefined;
  steps: PlannedStep[];
  feeWei: bigint;
  operation: MoneyOperation;
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

export function useSwap(initialPay?: string, initialReceive?: string) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const money = useMoneyAssets();
  const list = useTokenList();
  const runner = useMoneyOperation(`swap:${env.chainId}:${address?.toLowerCase() ?? "guest"}`);
  const coreReady = isDeployed(env.chainId, "SenryoCore");
  const risk = useAccountRisk(coreReady ? address : undefined, "latest");
  const fees = useQuery({
    queryKey: ["swap-fee", env.chainId],
    queryFn: () => userFeeCache(env.read).get(),
    staleTime: FEE_STALE_MS,
  });

  // Practice: both test dollars are receivable even when not held (the par pair, D-252).
  const receivable = receiveCandidates(env.chainId, money.assets, [
    ...parReceivables(env.chainId),
    ...(list.data ?? []),
  ]);
  const payable = [...money.assets, ...money.other].filter((a) => a.total > 0n);
  const lookup = (key: string | undefined) =>
    key ? (money.find(key) ?? receivable.find((a) => a.key === key.toLowerCase())) : undefined;
  const defaultPay = payable[0]?.key ?? NATIVE_TOKEN.toLowerCase();
  const [payKey, setPayKey] = useState<string | undefined>(initialPay?.toLowerCase());
  const [receiveKey, setReceiveKey] = useState<string | undefined>(initialReceive?.toLowerCase());
  const pay = lookup(payKey ?? defaultPay) ?? nativeMon(env.chainId, money.monWei);
  const fallbackReceive =
    parCounterpart(env.chainId, pay, receivable) ??
    receivable.find((a) => a.key !== pay.key && (a.collateral === "USDC" || a.native));
  const receive = lookup(receiveKey) ?? fallbackReceive;
  const par = isParPair(env.chainId, pay, receive);

  const [reviewed, setReviewed] = useState<ReviewedSwap>();
  const cancelPrepare = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string>();

  const maxFee = fees.data?.maxFeePerGas ?? 0n;
  const swapGas = GAS_LIMITS.aggregatorSwap;
  const available = spendableOf(pay, pay.native ? swapGas * maxFee : 0n);
  const input = useAmountInput(pay.decimals, pegPriceUsd18(pay), available);
  const amount = useDebounced(input.amount, QUOTE_DEBOUNCE_MS);
  const quoting = amount !== input.amount;
  const quote = useSwapQuote(
    !par && address && receive && amount > 0n && amount <= available
      ? { from: pay.address, to: receive.address, amount, sender: address }
      : undefined,
  );
  const value = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const ok = value?.status === "ok" && value.amountIn === input.amount ? value : undefined;

  const block: SwapBlock | undefined = !address
    ? "account"
    : input.amount === 0n
      ? "empty"
      : input.over
        ? "short"
        : par
          ? undefined
          : value?.status === "unsupported"
            ? "unsupported"
            : receive && !receive.verified
              ? "unverified-receive"
              : quoting || (quote.status === "unknown" && !ok)
                ? "quoting"
                : quote.status === "failed"
                  ? "failed"
                  : value?.status === "no_route"
                    ? "no-route"
                    : !ok
                      ? "quoting"
                      : ok.quote.impact === "block"
                        ? "impact"
                        : undefined;

  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const guard = useReviewGuard([env.chainId, address, pay.key, receive?.key, input.amount, runner.reviewKey].join(":"));

  useEffect(() => {
    if (!runner.trace.running && runner.trace.events.length === 0) setReviewed(undefined);
  }, [runner.reviewKey]);

  /** Re-read what pays for it before the first step signs: the wallet (MON less its reserve) plus the free trading part. */
  const revalidate = async (frozen: Pick<ReviewedSwap, "pay" | "amount">, step: number) => {
    guard();
    if (!address) throw new Error("Review again.");
    if (step > 0) return;
    const { pay: p, amount: a } = frozen;
    const wallet = p.native
      ? await env.read.getBalance({ address, blockTag: "latest" })
      : await env.read.readContract({
          address: p.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
          blockTag: "latest",
        });
    const free =
      p.collateral && coreReady
        ? maxWithdrawable(await readAccountSnapshot(env.read, env.chainId, address, "latest"), p.collateral)
        : 0n;
    if (p.native && wallet - a < MON_RESERVE_WEI + swapGas * maxFee)
      throw new Error("Keep 10 MON and the network fee. Review again.");
    if (wallet + free < a) throw new Error(`Not enough ${p.symbol} now. Review again.`);
    guard();
  };

  /** The swap's own steps: the par leg in Practice (nothing to re-quote), else the quote's, re-quoted at signing. */
  const swapStepsFor = async (owner: `0x${string}`, quoted: SwapQuoteOk | undefined): Promise<PlannedStep[]> => {
    const label = { approve: `Approve ${pay.symbol}`, swap: "Swap" };
    if (!quoted) return practiceSwapLeg(env, owner, pay.address, input.amount, label, "swap");
    const requests = await aggregatorSwapRequests(env, owner, quoted, { gasCostWei: swapGas * maxFee });
    return requests.map((request, i) => {
      const last = i === requests.length - 1;
      return {
        role: "swap" as const,
        action: request.action,
        label: last ? label.swap : label.approve,
        request,
        ...(last ? { build: () => requote(quoted) } : {}),
      };
    });
  };

  /** Freezes the quote and builds the sends; the fee preflight runs here, before anything is signed. */
  const review = async () => {
    if (!address || !(ok || par) || !receive || block) return;
    if (preparing) return;
    const request = ++cancelPrepare.current;
    const checkReview = () => {
      guard();
      if (request !== cancelPrepare.current) throw new Error("Review again.");
    };
    setPreparing(true);
    setProblem(undefined);
    try {
      checkReview();
      const pull = pullToSelfStep(env.chainId, pay, input.amount, address, snapshot?.positionBitmap ?? 0);
      const swapSteps = await swapStepsFor(address, par ? undefined : ok);
      checkReview();
      const own = pull ? [pull, ...swapSteps] : swapSteps;
      // B11: MON short for the fee → "swap ~$0.50 to MON" goes first in the same operation (Details: "Network fee").
      const walletPart = input.amount < pay.wallet ? input.amount : pay.wallet;
      const q = par ? undefined : ok;
      const minOut = q ? q.quote.minOut : input.amount;
      const quotedOut = q ? q.quote.amountOut : input.amount;
      const paid = amountOf(pay, input.amount);
      const atLeast = amountOf(receive, minOut);
      const prepared = await runner.prepare({
        steps: own,
        reviewedIntent: {
          kind: "swap",
          symbol: pay.symbol,
          asset: pay.key,
          decimals: String(pay.decimals),
          amount: input.amount.toString(),
          outSymbol: receive.symbol,
          outAsset: receive.key,
          outDecimals: String(receive.decimals),
          minOut: minOut.toString(),
          quotedOut: quotedOut.toString(),
          paid,
          atLeast,
          quoted: amountOf(receive, quotedOut),
          route: q ? swapProviderName(q.quote.provider) : PRACTICE_SWAP_ROUTE,
          recipient: address,
          source: "wallet",
          destination: "wallet",
        },
        revalidate: (step) => {
          checkReview();
          return revalidate({ pay, amount: input.amount }, step);
        },
        stepUp: q
          ? {
              title: `Swap ${paid} for ${receive.symbol}`,
              detail: `At least ${atLeast} through ${swapProviderName(q.quote.provider)} on Monad — real money. Swaps always ask for ${UNLOCK_WORD} again.`,
              confirmLabel: `Swap with ${UNLOCK_WORD}`,
            }
          : parStepUp(pay, receive, input.amount),
        spends: { [pay.key]: walletPart },
      });
      checkReview();
      if (!prepared.ok) {
        setProblem(prepared.block);
        return;
      }
      const steps = prepared.op.steps;
      const feeWei = par ? 0n : (await operationFeeNeed(env.read, address, steps)).needWei;
      checkReview();
      setReviewed({
        pay,
        receive,
        amount: input.amount,
        quote: par ? undefined : ok,
        steps,
        feeWei,
        operation: prepared.op,
      });
    } catch (error) {
      if (request !== cancelPrepare.current) return;
      setProblem(
        error instanceof MonReserveError
          ? `Keep 10 MON for fees · max ${amountOf(pay, error.maxSpendWei)}`
          : error instanceof PracticeSwapFloatError
            ? `Practice swap holds ${amountOf(receive, error.float)} now · try less`
            : "Couldn’t prepare the swap · try again",
      );
    } finally {
      setPreparing(false);
    }
  };

  /** The fresh quote the swap is signed with: same router, at least the reviewed minimum — else back to review. */
  const requote = async (was: SwapQuoteOk) => {
    if (!address) throw new Error("Review again.");
    const fresh = await env.api.call(swapQuoteRoute, {
      query: {
        chainId: env.chainId,
        from: was.from.address,
        to: was.to.address,
        amount: was.amountIn,
        sender: address,
        slippageBps: was.slippageBps,
      },
    });
    if (
      fresh.status !== "ok" ||
      fresh.quote.minOut < was.quote.minOut ||
      fresh.quote.router.toLowerCase() !== was.quote.router.toLowerCase()
    ) {
      throw new Error("Price moved · review again");
    }
    const requests = await aggregatorSwapRequests(env, address, fresh, { gasCostWei: swapGas * maxFee });
    const swap = requests.at(-1);
    if (!swap || requests.length > 1) throw new Error("Price moved · review again");
    return swap;
  };

  const confirm = async () => {
    if (!reviewed || !address) return;
    try {
      guard();
      await runner.run(reviewed.operation);
    } catch (error) {
      setProblem(error instanceof Error ? error.message.split("\n")[0] : "Swap interrupted · review again");
      setReviewed(undefined);
    }
  };

  return {
    address,
    money,
    payable,
    receivable,
    pay,
    receive,
    available,
    input,
    quote,
    ok,
    block,
    preparing,
    problem,
    reviewed,
    runner,
    /** Practice AUSD ↔ USDC at par (D-252): no quote; the output is the typed amount. */
    par,
    feeWei: (ok?.quote.gasLimit ?? swapGas) * maxFee,
    tokenListFailed: list.isError,
    setPay: (key: string) => {
      if (receive && key === receive.key) setReceiveKey(pay.key);
      setPayKey(key);
      input.reset();
      setProblem(undefined);
    },
    setReceive: (key: string) => {
      if (key === pay.key) setPayKey(receive?.key);
      setReceiveKey(key);
      setProblem(undefined);
    },
    flip: () => {
      if (!receive) return;
      setPayKey(receive.key);
      setReceiveKey(pay.key);
      input.reset();
      setProblem(undefined);
    },
    review,
    closeReview: () => {
      setReviewed(undefined);
      cancelPrepare.current += 1;
    },
    confirm,
    clearProblem: () => setProblem(undefined),
  };
}

export type SwapState = ReturnType<typeof useSwap>;
