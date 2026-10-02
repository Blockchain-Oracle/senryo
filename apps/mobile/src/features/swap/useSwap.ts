/**
 * Swap any ↔ any (B6, routes.md §2): what is paid (any holding — an unverified token sells only, warned), what is
 * received (any verified token), the exact amount, the live best-of quote (Monorail · KyberSwap, pinned routers) and
 * what stops it, in the order checked. "Review" freezes the quote and builds the sends ([pull from trades]? →
 * [approve exact]? → swap) with the fee preflight (B11; defect 12); the slide signs them under one step-up, and the
 * swap's calldata is re-quoted the moment before signing — accepted only if it still gives the reviewed minimum
 * through the same router (order-book routes go stale within blocks).
 */
import { type SwapQuoteOk, swapQuoteRoute } from "@senryo/api-client";
import { erc20Abi, isDeployed, MonReserveError, readAccountSnapshot } from "@senryo/chain";
import { GAS_LIMITS, NATIVE_TOKEN } from "@senryo/config";
import {
  aggregatorSwapRequests,
  maxWithdrawable,
  useAccountRisk,
  useQueryEnv,
  userFeeCache,
  useSwapQuote,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAmountInput } from "~/features/money/amount";
import { type MoneyAsset, spendableOf } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { pullToSelfStep } from "~/features/money/requests";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { type MoneyOperation, type PlannedStep, useMoneyOperation } from "~/features/money/useMoneyOperation";
import { useTokenList } from "~/features/money/useTokenList";
import { useAccount } from "~/lib/account/provider";
import { useReviewGuard } from "~/lib/review-guard";
import { nativeMon, receiveCandidates } from "./swap-assets";
import { monFee, swapProviderName } from "./swap-format";

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
  quote: SwapQuoteOk;
  steps: PlannedStep[];
  feeWei: bigint;
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

  const receivable = receiveCandidates(env.chainId, money.assets, list.data ?? []);
  const payable = [...money.assets, ...money.other].filter((a) => a.total > 0n);
  const lookup = (key: string | undefined) =>
    key ? (money.find(key) ?? receivable.find((a) => a.key === key.toLowerCase())) : undefined;
  const defaultPay = payable[0]?.key ?? NATIVE_TOKEN.toLowerCase();
  const [payKey, setPayKey] = useState<string | undefined>(initialPay?.toLowerCase());
  const [receiveKey, setReceiveKey] = useState<string | undefined>(initialReceive?.toLowerCase());
  const pay = lookup(payKey ?? defaultPay) ?? nativeMon(env.chainId, money.monWei);
  const fallbackReceive = receivable.find((a) => a.key !== pay.key && (a.collateral === "USDC" || a.native));
  const receive = lookup(receiveKey) ?? fallbackReceive;

  const [reviewed, setReviewed] = useState<ReviewedSwap>();
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string>();

  const maxFee = fees.data?.maxFeePerGas ?? 0n;
  const swapGas = GAS_LIMITS.aggregatorSwap;
  const available = spendableOf(pay, pay.native ? swapGas * maxFee : 0n);
  const input = useAmountInput(pay.decimals, pay.priceUsd18, available);
  const amount = useDebounced(input.amount, QUOTE_DEBOUNCE_MS);
  const quoting = amount !== input.amount;
  const quote = useSwapQuote(
    address && receive && amount > 0n && amount <= available
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
  const guard = useReviewGuard(
    [env.chainId, address, pay.key, receive?.key, input.amount, reviewed?.quote.quote.minOut ?? ""].join(":"),
  );

  /** Re-read what pays for it: the wallet (MON less its reserve) plus the free trading part. */
  const revalidate = async () => {
    guard();
    if (!address || !reviewed) throw new Error("Review again.");
    const { pay: p, amount: a } = reviewed;
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
    if (wallet + free < a) throw new Error(`Not enough ${p.symbol} now. Review again.`);
    guard();
  };

  /** Freezes the quote and builds the sends; the fee preflight runs here, before anything is signed. */
  const review = async () => {
    if (!address || !ok || !receive || block) return;
    setPreparing(true);
    setProblem(undefined);
    try {
      const pull = pullToSelfStep(env.chainId, pay, input.amount, address, snapshot?.positionBitmap ?? 0);
      const requests = await aggregatorSwapRequests(env, address, ok, { gasCostWei: swapGas * maxFee });
      const swapSteps: PlannedStep[] = requests.map((request, i) => {
        const last = i === requests.length - 1;
        return {
          action: request.action,
          label: last ? "Swap" : `Approve ${pay.symbol}`,
          request,
          ...(last ? { build: () => requote(ok) } : {}),
        };
      });
      const steps = pull ? [pull, ...swapSteps] : swapSteps;
      const fee = await runner.checkFees({ steps });
      if (!fee.ok) {
        setProblem(`Add MON for fees · ${monFee(fee.shortWei)} short`);
        return;
      }
      setReviewed({ pay, receive, amount: input.amount, quote: ok, steps, feeWei: swapGas * maxFee });
    } catch (error) {
      setProblem(
        error instanceof MonReserveError
          ? `Keep 10 MON for fees · max ${amountOf(pay, error.maxSpendWei)}`
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
    const { pay: p, receive: r, quote: q } = reviewed;
    const paid = amountOf(p, reviewed.amount);
    const atLeast = amountOf(r, q.quote.minOut);
    const op: MoneyOperation = {
      steps: reviewed.steps,
      revalidate,
      reviewedIntent: {
        kind: "swap",
        symbol: p.symbol,
        asset: p.key,
        decimals: String(p.decimals),
        amount: reviewed.amount.toString(),
        outSymbol: r.symbol,
        outAsset: r.key,
        outDecimals: String(r.decimals),
        minOut: q.quote.minOut.toString(),
        quotedOut: q.quote.amountOut.toString(),
        paid,
        atLeast,
        quoted: amountOf(r, q.quote.amountOut),
        route: swapProviderName(q.quote.provider),
        recipient: address,
        source: "wallet",
        destination: "wallet",
      },
      stepUp: {
        title: `Swap ${paid} for ${r.symbol}`,
        detail: `At least ${atLeast} through ${swapProviderName(q.quote.provider)} on Monad — real money. Swaps always ask for a fresh passkey check.`,
        confirmLabel: "Swap with passkey",
      },
    };
    const fee = await runner.checkFees(op);
    if (!fee.ok) {
      setProblem(`Add MON for fees · ${monFee(fee.shortWei)} short`);
      setReviewed(undefined);
      return;
    }
    await runner.run(op);
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
    closeReview: () => setReviewed(undefined),
    confirm,
    clearProblem: () => setProblem(undefined),
  };
}

export type SwapState = ReturnType<typeof useSwap>;
