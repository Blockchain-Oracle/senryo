/**
 * Withdraw to another chain (flow book B9; routes.md §3, §7): the quote for the asset's own route, or — for a
 * verified asset with no route — "Swap to USDC and withdraw" as ONE operation: [pull from trades]? → [approve]? →
 * swap → [approve]? → bridge, signed under one slide and one passkey (B0.4). The swap leg re-quotes right before it
 * is signed (same router, at least the reviewed minimum); the bridge leg re-quotes only if its quote expired, and then
 * only to an equal-or-better minimum on the same provider. Anything else stops at that step and goes back to review —
 * completed steps are never resent. An unverified token never auto-composes (BD-7).
 */
import {
  type BridgeQuoteOk,
  type BridgeRouteChain,
  bridgeQuoteRoute,
  type SwapQuoteOk,
  swapQuoteRoute,
} from "@senryo/api-client";
import type { TxRequest } from "@senryo/chain";
import type { BridgeAsset } from "@senryo/config";
import { aggregatorSwapRequests, bridgeSendRequests, type QueryEnv } from "@senryo/query";
import type { MoneyAsset } from "@/lib/money/assets";
import { exactAmount, tokenAmount } from "@/lib/money/format";
import { pullToSelfStep } from "@/lib/money/requests";
import type { MoneyOperation, PlannedStep } from "@/lib/money/use-money-operation";

const MS_PER_SECOND = 1000;
const MOVED = "Price moved · review again";

export interface ChainPlan {
  asset: MoneyAsset;
  amount: bigint;
  chain: BridgeRouteChain;
  recipient: string;
  /** The bridge leg's asset: the asset itself, or USDC after the swap. */
  bridgeAsset: BridgeAsset;
  bridge: BridgeQuoteOk;
  swap?: SwapQuoteOk | undefined;
}

/** EVM 0x…, Solana base58 (32–44), Tron T… (34). */
export function addressFits(vm: BridgeRouteChain["vm"], address: string): boolean {
  if (vm === "evm") return /^0x[0-9a-fA-F]{40}$/.test(address);
  if (vm === "svm") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export function vmName(vm: BridgeRouteChain["vm"]): string {
  return vm === "evm" ? "an EVM" : vm === "svm" ? "a Solana" : "a Tron";
}

function bridgeQuery(env: QueryEnv, me: string, plan: ChainPlan, amount: bigint) {
  const remote = plan.chain.remote[0]?.asset;
  return {
    fromChain: env.chainId,
    toChain: plan.chain.chainId,
    asset: plan.bridgeAsset,
    amount,
    sender: me as `0x${string}`,
    recipient: plan.recipient,
    ...(remote ? { remote } : {}),
    provider: plan.bridge.provider,
  };
}

async function freshSwap(env: QueryEnv, me: `0x${string}`, was: SwapQuoteOk): Promise<TxRequest> {
  const fresh = await env.api.call(swapQuoteRoute, {
    query: {
      chainId: env.chainId,
      from: was.from.address,
      to: was.to.address,
      amount: was.amountIn,
      sender: me,
      slippageBps: was.slippageBps,
    },
  });
  if (
    fresh.status !== "ok" ||
    fresh.quote.minOut < was.quote.minOut ||
    fresh.quote.router.toLowerCase() !== was.quote.router.toLowerCase()
  ) {
    throw new Error(MOVED);
  }
  const requests = await aggregatorSwapRequests(env, me, fresh);
  const swap = requests.at(-1);
  if (!swap || requests.length > 1) throw new Error(MOVED);
  return swap;
}

async function bridgeCall(env: QueryEnv, me: `0x${string}`, plan: ChainPlan, amount: bigint): Promise<TxRequest> {
  const expired = plan.bridge.expiresAt !== null && plan.bridge.expiresAt * MS_PER_SECOND < Date.now();
  let quote = plan.bridge;
  if (expired) {
    const fresh = await env.api.call(bridgeQuoteRoute, { query: bridgeQuery(env, me, plan, amount) });
    if (
      fresh.status !== "ok" ||
      fresh.minReceived < plan.bridge.minReceived ||
      fresh.provider !== plan.bridge.provider
    ) {
      throw new Error(MOVED);
    }
    quote = fresh;
  }
  const requests = await bridgeSendRequests(env, me, quote);
  const call = requests.at(-1);
  if (!call) throw new Error(MOVED);
  return call;
}

/** The planned steps of a reviewed withdrawal to another chain. */
export async function chainSteps(
  env: QueryEnv,
  me: `0x${string}`,
  plan: ChainPlan,
  positionBitmap: number,
): Promise<PlannedStep[]> {
  const steps: PlannedStep[] = [];
  const pull = pullToSelfStep(env.chainId, plan.asset, plan.amount, me, positionBitmap);
  if (pull) steps.push(pull);
  if (plan.swap) {
    const swap = plan.swap;
    const swapRequests = await aggregatorSwapRequests(env, me, swap);
    swapRequests.forEach((request, i) => {
      const last = i === swapRequests.length - 1;
      steps.push({
        action: request.action,
        label: last ? "Swap to USDC" : `Approve ${plan.asset.symbol}`,
        request,
        ...(last ? { build: () => freshSwap(env, me, swap) } : {}),
      });
    });
  }
  const bridgeAmount = plan.swap ? plan.swap.quote.minOut : plan.amount;
  const bridgeRequests = await bridgeSendRequests(env, me, plan.bridge);
  bridgeRequests.forEach((request, i) => {
    const last = i === bridgeRequests.length - 1;
    steps.push({
      action: request.action,
      label: last ? `Send to ${plan.chain.name}` : `Approve ${plan.bridgeAsset}`,
      request,
      ...(last ? { build: () => bridgeCall(env, me, plan, bridgeAmount) } : {}),
    });
  });
  return steps;
}

export function chainOperation(
  plan: ChainPlan,
  steps: PlannedStep[],
  network: string,
  revalidate: (stepIndex: number) => Promise<void>,
): MoneyOperation {
  const { asset, amount, chain, bridge } = plan;
  const exact = exactAmount(asset, amount);
  const receive = tokenAmount(bridge.minReceived, bridge.out.decimals, bridge.out.symbol);
  return {
    steps,
    revalidate,
    reviewedIntent: {
      kind: "bridge",
      symbol: asset.symbol,
      asset: asset.key,
      decimals: String(asset.decimals),
      amount: amount.toString(),
      recipient: plan.recipient,
      destination: chain.name,
      destinationChainId: String(chain.chainId),
      provider: bridge.provider,
      trackingId: bridge.tracking.id ?? "",
      outSymbol: bridge.out.symbol,
      outDecimals: String(bridge.out.decimals),
      minOut: bridge.minReceived.toString(),
      network,
      ...(plan.swap ? { via: "USDC" } : {}),
    },
    stepUp: {
      title: `Withdraw ${exact} to ${chain.name}`,
      detail: `At least ${receive} arrives at ${plan.recipient} on ${chain.name}. Money leaving Monad always asks for a fresh passkey check.`,
      confirmLabel: "Withdraw with passkey",
    },
  };
}
