/**
 * Withdraw to another chain — review, slide, timeline (flow book B9 steps 4–5; plan §0.9 Withdraw "Review" and
 * "Status"): the asset's mark → the chain's mark, what arrives at least, the fees, the time and the route with its
 * provider's mark (and the steps when it swaps to USDC first), the live quote under the slide (a changed quote resets
 * it). Signed, the sheet becomes the outcome with the cross-chain timeline: Sent → Bridging → Delivered.
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import { type BridgeAsset, MAINNET_TOKENS } from "@senryo/config";
import { type BridgeStatusRef, useBridgeQuote, useQueryEnv, useSwapQuote } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { AssetMark } from "~/features/money/AssetMark";
import type { MoneyAsset } from "~/features/money/assets";
import { BridgeTimeline } from "~/features/money/BridgeTimeline";
import { etaText, providerMark, providerName } from "~/features/money/ChainGrid";
import { exactAmount } from "~/features/money/format";
import { MoneyOutcome, MoveLine, ReviewRow, ReviewRows } from "~/features/money/Review";
import type { MoneyOperationRunner } from "~/features/money/useMoneyOperation";
import { BRIDGE_WORDS } from "~/features/money/words";
import { tokenAmount } from "~/features/tokens/format";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { ChainPlan } from "./chain-withdraw";

export interface ChainTarget {
  asset: MoneyAsset;
  amount: bigint;
  chain: BridgeRouteChain;
  recipient: string;
  composed: boolean;
}

/** The live quote(s) for a target: the bridge leg, and the swap leg first when it goes as USDC. */
export function useChainPlan(target: ChainTarget | undefined, me: `0x${string}`): ChainPlan | "quoting" | string {
  const env = useQueryEnv();
  const swap = useSwapQuote(
    target?.composed
      ? { from: target.asset.address, to: MAINNET_TOKENS.usdc, amount: target.amount, sender: me }
      : undefined,
  );
  const s = swap.status === "fresh" || swap.status === "stale" ? swap.value : undefined;
  const swapOk = s?.status === "ok" ? s : undefined;
  const bridgeAsset: BridgeAsset | undefined = target ? (target.composed ? "USDC" : target.asset.bridge) : undefined;
  const bridgeAmount = target?.composed ? swapOk?.quote.minOut : target?.amount;
  const remote = target?.chain.remote[0]?.asset;
  const bridge = useBridgeQuote(
    target && bridgeAsset && bridgeAmount !== undefined
      ? {
          fromChain: env.chainId,
          toChain: target.chain.chainId,
          asset: bridgeAsset,
          amount: bridgeAmount,
          sender: me,
          recipient: target.recipient,
          ...(remote ? { remote } : {}),
        }
      : undefined,
  );
  if (!target || !bridgeAsset) return "No route";
  if (target.composed && s && s.status !== "ok")
    return s.status === "no_route" ? "No route to USDC" : "Swaps run on Mainnet";
  if (target.composed && swapOk?.quote.impact === "block") return "Too big · try less";
  const b = bridge.status === "fresh" || bridge.status === "stale" ? bridge.value : undefined;
  if (b?.status === "unsupported") return b.reason;
  if (bridge.status === "failed" || swap.status === "failed") return "Quote unavailable · try again";
  if (b?.status !== "ok") return "quoting";
  return { ...target, bridgeAsset, bridge: b, ...(swapOk ? { swap: swapOk } : {}) };
}

export function ChainReview({
  target,
  plan,
  runner,
  steps,
  block,
  busy,
  onConfirm,
  onDone,
  onLeave,
}: {
  target: ChainTarget | undefined;
  plan: ChainPlan | "quoting" | string;
  runner: MoneyOperationRunner;
  /** The prepared steps line ("Network fee · Swap to USDC · Send to Base"), when it has more than one step. */
  steps?: string | undefined;
  block: string | undefined;
  busy: boolean;
  onConfirm: (plan: ChainPlan) => void;
  onDone: () => void;
  onLeave: () => void;
}) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const record = runner.trace.record;
  if (runner.trace.running || runner.trace.events.length > 0 || !target) {
    const i = record?.reviewedIntent;
    const hash = runner.trace.events.find((e) => e.hash)?.hash;
    const finalized = runner.trace.events.some((e) => e.stage === "finalized") && !runner.trace.running;
    const tracking: BridgeStatusRef | undefined =
      i?.provider && (i.trackingId || hash)
        ? {
            route: i.provider as BridgeStatusRef["route"],
            id: i.trackingId || (hash as string),
            fromChain: env.chainId,
            ...(i.destinationChainId ? { toChain: Number.parseInt(i.destinationChainId, 10) } : {}),
          }
        : undefined;
    return (
      <View style={styles.stack}>
        <MoneyOutcome
          runner={runner}
          words={BRIDGE_WORDS}
          facts={
            i ? (
              <>
                <ReviewRow
                  label="Sent"
                  value={`${tokenAmount(BigInt(i.amount ?? "0"), Number.parseInt(i.decimals ?? "0", 10), i.symbol)}`}
                />
                <ReviewRow label="To" value={`${shortAddress(i.recipient ?? "")} · ${i.destination ?? ""}`} />
              </>
            ) : null
          }
          onDone={onDone}
          onLeave={onLeave}
        />
        {i?.destination ? <BridgeTimeline tracking={tracking} sent={finalized} destination={i.destination} /> : null}
      </View>
    );
  }
  const exact = exactAmount(target.asset, target.amount);
  const ok = typeof plan === "object" ? plan : undefined;
  const feeUsd6 = ok?.bridge.fees.reduce((sum, f) => sum + (f.usd6 ?? 0n), 0n) ?? 0n;
  const reason = typeof plan === "string" ? (plan === "quoting" ? "Getting a quote" : plan) : block;
  return (
    <View style={styles.stack}>
      <MoveLine
        from={<AssetMark asset={target.asset} size={SIZE.avatarLg} />}
        to={<EntityMark id={target.chain.mark} label={target.chain.name} size={SIZE.avatarLg} decorative />}
        fromLabel={exact}
        toLabel={target.chain.name}
      />
      <ReviewRows>
        <ReviewRow label="To" value={shortAddress(target.recipient)} />
        {ok ? (
          <>
            <ReviewRow
              label="You receive at least"
              value={tokenAmount(ok.bridge.minReceived, ok.bridge.out.decimals, ok.bridge.out.symbol)}
            />
            <ReviewRow label="Fees" value={feeUsd6 > 0n ? usd(feeUsd6, undefined, "mainnet") : "Included"} />
            <ReviewRow label="Time" value={etaText(ok.bridge.etaSec)} />
            <ReviewRow
              label="Route"
              value={providerName(ok.bridge.provider)}
              mark={
                <EntityMark
                  id={providerMark(ok.bridge.provider)}
                  label={providerName(ok.bridge.provider)}
                  size={SIZE.markChip}
                  decorative
                />
              }
            />
            {steps ? (
              <ReviewRow label="Steps" value={steps} />
            ) : ok.swap ? (
              <ReviewRow label="Steps" value={`Swap to USDC · Send to ${target.chain.name}`} />
            ) : null}
          </>
        ) : (
          <ReviewRow label="Quote" value={reason ?? "Getting a quote"} tone={plan === "quoting" ? undefined : "warn"} />
        )}
      </ReviewRows>
      {block ? <Text style={[TYPE.rowDetail, styles.center, { color: color.down }]}>{block}</Text> : null}
      <SlideToConfirm
        label={ok ? "Slide to withdraw" : (reason ?? "Getting a quote")}
        tone="primary"
        busy={busy}
        disabled={!ok || block !== undefined}
        resetKey={[
          target.asset.key,
          target.amount,
          target.chain.chainId,
          target.recipient,
          ok?.bridge.minReceived,
        ].join(":")}
        onConfirm={() => (ok ? onConfirm(ok) : undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  center: { textAlign: "center" },
});
