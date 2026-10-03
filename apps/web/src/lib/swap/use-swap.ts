"use client";

/**
 * Swap any ↔ any (flow book B6, routes.md §2; the phone's `useSwap`): what is paid (any holding — an unverified token
 * sells only), what is received (any verified token), the exact amount, the live best-of quote (Monorail · KyberSwap,
 * pinned routers) and what stops it, in the order checked. "Review" freezes the quote and builds the sends ([network
 * fee]? → [pull from trades]? → [approve exact]? → swap) with the fee planned (B11: MON short on Mainnet → "~$0.50 →
 * MON" first in the same operation, or the named shortfall); the slide signs them under one step-up, and the swap's
 * calldata is re-quoted the moment before signing — accepted only through the same router with at least the reviewed
 * minimum. In Practice, test AUSD ↔ test USDC swaps at par through PracticeSwap (D-252: no aggregator call, nothing to
 * re-quote); every other Practice pair stays locked ("Swaps run on Mainnet").
 */
import { type SwapQuoteOk, swapQuoteRoute } from "@senryo/api-client";
import {
  erc20Abi,
  isDeployed,
  MonReserveError,
  PRACTICE_SWAP_ROUTE,
  PracticeSwapFloatError,
  readAccountSnapshot,
} from "@senryo/chain";
import { GAS_LIMITS, NATIVE_TOKEN } from "@senryo/config";
import {
  aggregatorSwapRequests,
  isParPair,
  maxWithdrawable,
  parCounterpart,
  parReceivables,
  parStepUp,
  practiceSwapLeg,
  useAccountRisk,
  useQueryEnv,
  userFeeCache,
  useSwapQuote,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { parseAmount, plainAmount } from "@/lib/money/amount";
import { type MoneyAsset, spendableOf } from "@/lib/money/assets";
import { amountOf } from "@/lib/money/format";
import { pullToSelfStep } from "@/lib/money/requests";
import { useTokenList } from "@/lib/money/token-list";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { type MoneyOperation, type PlannedStep, useMoneyOperation } from "@/lib/money/use-money-operation";
import { useReviewGuard } from "@/lib/review-guard";
import { nativeMon, receiveCandidates } from "./assets";
import { swapProviderName } from "./format";

const QUOTE_DEBOUNCE_MS = 350;
const FEE_STALE_MS = 15_000;
const MOVED = "Price moved · review again";

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
  /** The prepared steps, a "Network fee" swap first when MON is short (B11). */
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
  const address = useAccount().hint?.address;
  const money = useMoneyAssets(address);
  const list = useTokenList();
  const runner = useMoneyOperation(`swap:${env.chainId}:${address?.toLowerCase() ?? "guest"}`);
  const coreReady = isDeployed(env.chainId, "SenryoCore");
  const snapshot = known(useAccountRisk(coreReady ? address : undefined, "latest"));
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
  const [payKey, setPayKey] = useState<string | undefined>(initialPay?.toLowerCase());
  const [receiveKey, setReceiveKey] = useState<string | undefined>(initialReceive?.toLowerCase());
  const pay = lookup(payKey ?? payable[0]?.key ?? NATIVE_TOKEN.toLowerCase()) ?? nativeMon(env.chainId, money.monWei);
  const fallbackReceive =
    parCounterpart(env.chainId, pay, receivable) ??
    receivable.find((a) => a.key !== pay.key && (a.collateral === "USDC" || a.native));
  const receive = lookup(receiveKey) ?? fallbackReceive;
  const par = isParPair(env.chainId, pay, receive);

  const [text, setText] = useState("");
  const [max, setMax] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedSwap>();
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string>();

  const maxFee = fees.data?.maxFeePerGas ?? 0n;
  const swapGas = GAS_LIMITS.aggregatorSwap;
  const available = spendableOf(pay, pay.native ? swapGas * maxFee : 0n);
  const typed = max ? available : parseAmount(text, pay.decimals);
  const amount = useDebounced(typed, QUOTE_DEBOUNCE_MS);
  const quote = useSwapQuote(
    !par && address && receive && amount > 0n && amount <= available
      ? { from: pay.address, to: receive.address, amount, sender: address }
      : undefined,
  );
  const value = known(quote);
  const ok = value?.status === "ok" && value.amountIn === typed ? value : undefined;

  const block: SwapBlock | undefined = !address
    ? "account"
    : typed === 0n
      ? "empty"
      : typed > available
        ? "short"
        : par
          ? undefined
          : value?.status === "unsupported"
            ? "unsupported"
            : receive && !receive.verified
              ? "unverified-receive"
              : amount !== typed || (quote.status === "unknown" && !ok)
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

  const guard = useReviewGuard(
    [env.chainId, address, pay.key, receive?.key, typed, reviewed?.quote?.quote.minOut ?? ""].join(":"),
  );

  /** Before the first step signs: the wallet (MON less its reserve) plus the free trading part still pays for it. */
  const revalidate = async (step: number) => {
    guard();
    if (!address || !reviewed) throw new Error("Review again.");
    if (step > 0) return;
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
    )
      throw new Error(MOVED);
    const requests = await aggregatorSwapRequests(env, address, fresh, { gasCostWei: swapGas * maxFee });
    const swap = requests.at(-1);
    if (!swap || requests.length > 1) throw new Error(MOVED);
    return swap;
  };

  /** The swap's own steps: the par leg in Practice (nothing to re-quote), else the quote's, re-quoted at signing. */
  const swapStepsFor = async (owner: `0x${string}`, quoted: SwapQuoteOk | undefined): Promise<PlannedStep[]> => {
    const label = { approve: `Approve ${pay.symbol}`, swap: "Swap" };
    if (!quoted) return practiceSwapLeg(env, owner, pay.address, typed, label, "swap");
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

  /** Freezes the quote and builds the sends; the network fee is planned here, before anything is signed (B11). */
  const review = async () => {
    if (!address || !(ok || par) || !receive || block) return;
    setPreparing(true);
    setProblem(undefined);
    try {
      const pull = pullToSelfStep(env.chainId, pay, typed, address, snapshot?.positionBitmap ?? 0);
      const swapSteps = await swapStepsFor(address, par ? undefined : ok);
      const own = pull ? [pull, ...swapSteps] : swapSteps;
      const walletPart = typed < pay.wallet ? typed : pay.wallet;
      const prepared = await runner.prepare({
        steps: own,
        reviewedIntent: {},
        revalidate: async () => undefined,
        spends: { [pay.key]: walletPart },
      });
      if (!prepared.ok) return setProblem(prepared.block);
      const feeWei = par ? 0n : swapGas * maxFee;
      setReviewed({ pay, receive, amount: typed, quote: par ? undefined : ok, steps: prepared.op.steps, feeWei });
    } catch (error) {
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

  const confirm = async () => {
    if (!reviewed || !address) return;
    const { pay: p, receive: r, quote: q, amount: a } = reviewed;
    // The par swap's minimum and estimate are the amount itself (D-252).
    const minOut = q ? q.quote.minOut : a;
    const quotedOut = q ? q.quote.amountOut : a;
    const paid = amountOf(p, a);
    const atLeast = amountOf(r, minOut);
    const op: MoneyOperation = {
      steps: reviewed.steps,
      revalidate,
      reviewedIntent: {
        kind: "swap",
        symbol: p.symbol,
        asset: p.key,
        decimals: String(p.decimals),
        amount: a.toString(),
        outSymbol: r.symbol,
        outAsset: r.key,
        outDecimals: String(r.decimals),
        minOut: minOut.toString(),
        quotedOut: quotedOut.toString(),
        paid,
        atLeast,
        quoted: amountOf(r, quotedOut),
        route: q ? swapProviderName(q.quote.provider) : PRACTICE_SWAP_ROUTE,
        recipient: address,
        source: "wallet",
        destination: "wallet",
      },
      stepUp: q
        ? {
            title: `Swap ${paid} for ${r.symbol}`,
            detail: `At least ${atLeast} through ${swapProviderName(q.quote.provider)} on Monad — real money. Swaps always ask for a fresh passkey check.`,
            confirmLabel: "Swap with passkey",
          }
        : parStepUp(paid, amountOf(r, a), r.symbol),
    };
    await runner.run(op);
  };

  const resetAmount = () => {
    setText("");
    setMax(false);
  };
  return {
    address,
    money,
    payable,
    receivable,
    pay,
    receive,
    available,
    text,
    typed,
    setText: (t: string) => {
      setMax(false);
      setText(t);
    },
    fillMax: () => {
      setMax(true);
      setText(plainAmount(available, pay.decimals));
    },
    quote,
    value,
    ok,
    block,
    /** Practice AUSD ↔ USDC at par (D-252): no quote; the output is the typed amount. */
    par,
    preparing,
    problem,
    reviewed,
    runner,
    feeWei: (ok?.quote.gasLimit ?? swapGas) * maxFee,
    tokenListFailed: list.isError,
    setPay: (key: string) => {
      if (receive && key === receive.key) setReceiveKey(pay.key);
      setPayKey(key);
      resetAmount();
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
      resetAmount();
      setProblem(undefined);
    },
    review,
    closeReview: () => setReviewed(undefined),
    confirm,
    /** After a finished swap: a fresh ticket. */
    clear: () => {
      setReviewed(undefined);
      resetAmount();
    },
  };
}

export type SwapState = ReturnType<typeof useSwap>;
