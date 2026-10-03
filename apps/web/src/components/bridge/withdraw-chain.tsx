"use client";

/**
 * Withdraw to another chain (flow book B9; the phone's WithdrawFlow chain branch + ChainReview): an asset this network
 * bridges (Practice: Circle's testnet USDC over CCTP), a chain from the live routes for it (marks, time, provider), the
 * address there (checked for that chain's format), the exact amount, the quote — at least, fees, time, route — then
 * review → one slide and the passkey (money leaving Monad always asks) → the outcome with the cross-chain timeline.
 * A dollar asset's trading part is pulled first in the same operation; on Mainnet the network fee is planned with the
 * review (B11: MON on hand, or "~$0.50 → MON" first, or the named shortfall); the bridge leg re-quotes only if its
 * quote expired, and then only to an equal-or-better minimum on the same provider. Nothing is resent.
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import { isDeployed } from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { stepsLine, useAccountRisk, useBridgeQuote, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { useId, useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { DetailRow, QuietLine } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { SEND_WORDS } from "@/components/kit/trace-words";
import { AssetPicker } from "@/components/money/asset-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { known } from "@/components/ui/reading";
import { addressFits, chainOperation, chainSteps, vmName } from "@/lib/bridge/chain-withdraw";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { cleanAmountText, parseAmount } from "@/lib/money/amount";
import { type MoneyAsset, spendableOf } from "@/lib/money/assets";
import { amountOf, tokenAmount } from "@/lib/money/format";
import { checkSource, feeEstimate } from "@/lib/money/move";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { type MoneyOperation, useMoneyOperation } from "@/lib/money/use-money-operation";
import { useReviewGuard } from "@/lib/review-guard";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { BridgeTimeline, ChainGrid, etaText, providerName } from "./chain-grid";

const WORDS = {
  ...SEND_WORDS,
  thing: "withdrawal",
  again: "withdraw it again",
  pending: "Withdrawing",
  success: "Sent",
};

function Route({ me, asset, chain }: { me: `0x${string}`; asset: MoneyAsset; chain: BridgeRouteChain }) {
  const env = useQueryEnv();
  const bridgeAsset = asset.bridge;
  const runner = useMoneyOperation(`bridge:${env.chainId}:${me.toLowerCase()}`);
  const outcome = useSettledOutcome(runner.trace.events);
  const bitmap =
    known(useAccountRisk(isDeployed(env.chainId, "SenryoCore") ? me : undefined, "latest"))?.positionBitmap ?? 0;
  const addressId = useId();
  const [recipient, setRecipient] = useState("");
  const [text, setText] = useState("");
  /** The reviewed operation, its network fee planned (B11), and that fee in words. */
  const [prepared, setPrepared] = useState<{ op: MoneyOperation; fee: string }>();
  const [problem, setProblem] = useState<string>();
  const amount = parseAmount(text, asset.decimals);
  const available = spendableOf(asset);
  const fits = addressFits(chain.vm, recipient.trim());
  const remote = chain.remote[0]?.asset;
  const quote = useBridgeQuote(
    bridgeAsset && fits && amount > 0n && amount <= available
      ? {
          fromChain: env.chainId,
          toChain: chain.chainId,
          asset: bridgeAsset,
          amount,
          sender: me,
          recipient: recipient.trim(),
          ...(remote ? { remote } : {}),
        }
      : undefined,
  );
  const q = known(quote);
  const ok = q?.status === "ok" ? q : undefined;
  const guard = useReviewGuard(
    [env.chainId, me, asset.key, amount, chain.chainId, recipient.trim(), ok?.minReceived ?? ""].join(":"),
  );
  const plan =
    ok && bridgeAsset ? { asset, amount, chain, recipient: recipient.trim(), bridgeAsset, bridge: ok } : undefined;

  if (runner.trace.events.length > 0 && plan)
    return (
      <OperationStatus
        events={runner.trace.events}
        record={runner.trace.record}
        running={runner.trace.running}
        outcome={outcome}
        words={{ ...WORDS, success: `Sent to ${chain.name}` }}
        facts={
          <BridgeTimeline
            tracking={{
              route: plan.bridge.provider,
              id: plan.bridge.tracking.id ?? runner.trace.events.find((e) => e.hash)?.hash ?? "",
              fromChain: env.chainId,
              toChain: chain.chainId,
            }}
            sent={outcome === "finalized"}
            destination={chain.name}
          />
        }
        onDone={() => {
          runner.reset();
          setPrepared(undefined);
        }}
        onLeave={() => setPrepared(undefined)}
      />
    );

  const review = async () => {
    if (!plan) return;
    setProblem(undefined);
    try {
      const planned = await chainSteps(env, me, plan, bitmap);
      const op = chainOperation(plan, planned, ACTIVE_NETWORK.name, async (index) => {
        guard();
        if (index === 0) await checkSource(env, me, asset, amount);
        guard();
      });
      // B11: MON on hand, or "~$0.50 → MON" first in the same operation, or the named shortfall — before the slide.
      const ready = await runner.prepare({
        ...op,
        spends: { [asset.key]: amount < asset.wallet ? amount : asset.wallet },
      });
      if (!ready.ok) return setProblem(ready.block);
      const mainnet = env.chainId === MAINNET_CHAIN_ID;
      setPrepared({ op: ready.op, fee: mainnet ? await feeEstimate(env, me, ready.op.steps) : "Sponsored" });
    } catch (error) {
      setProblem(error instanceof Error ? (error.message.split("\n")[0] ?? "") : "Couldn’t prepare it");
    }
  };
  const confirm = async () => {
    if (!prepared) return;
    await runner
      .run(prepared.op)
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message.split("\n")[0] : "Didn’t go through"));
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1 text-meta text-text-2">
        <label htmlFor={addressId}>Address on {chain.name}</label>
        <Input
          id={addressId}
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setPrepared(undefined);
          }}
          placeholder={chain.vm === "evm" ? "0x…" : "Address"}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-invalid={recipient !== "" && !fits}
        />
        {recipient !== "" && !fits ? <span className="text-down">Not {vmName(chain.vm)} address</span> : null}
      </div>
      <label className="grid justify-items-center gap-1">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label={`Amount of ${asset.symbol}`}
          value={text}
          onChange={(e) => {
            const next = cleanAmountText(e.target.value, asset.decimals);
            if (next !== undefined) {
              setText(next);
              setPrepared(undefined);
            }
          }}
          className="w-full bg-transparent text-center font-display text-display-margin outline-none tnum placeholder:text-text-3"
        />
        <span className="text-meta text-text-2">Available {amountOf(asset, available)}</span>
      </label>
      {amount > 0n && fits ? (
        <div>
          {ok ? (
            <>
              <DetailRow label="Arrives at least" value={tokenAmount(ok.minReceived, ok.out.decimals, ok.out.symbol)} />
              <DetailRow label="Time" value={etaText(ok.etaSec)} />
              <DetailRow label="Route" value={providerName(ok.provider)} />
            </>
          ) : q?.status === "unsupported" ? (
            <DetailRow label="Route" value={q.reason} tone="warn" />
          ) : quote.status === "failed" ? (
            <DetailRow label="Quote" value="Unavailable · try again" tone="warn" />
          ) : (
            <DetailRow label="Quote" value="Getting a quote" />
          )}
          {prepared ? <DetailRow label="Network fee" value={prepared.fee} /> : null}
          {prepared ? <DetailRow label="Steps" value={stepsLine(prepared.op.steps)} /> : null}
          {prepared ? <DetailRow label="Confirm with" value="Passkey" /> : null}
        </div>
      ) : null}
      {problem ? <p className="text-center text-meta text-down">{problem}</p> : null}
      {prepared && ok ? (
        <SlideToConfirm
          label={`Slide to send to ${chain.name}`}
          resetKey={`${amount}|${recipient}|${ok.minReceived}`}
          onConfirm={() => void confirm()}
        />
      ) : (
        <Button size="xl" disabled={!ok || amount > available} onClick={() => void review()}>
          {amount > available ? "More than available" : "Review"}
        </Button>
      )}
    </div>
  );
}

/** The chain branch of Withdraw: asset → chain → address, amount and quote → review → slide. */
export function WithdrawToChain({ me }: { me: `0x${string}` }) {
  const money = useMoneyAssets(me);
  const [asset, setAsset] = useState<MoneyAsset>();
  const [chain, setChain] = useState<BridgeRouteChain>();
  const routes = useBridgeRoutes(asset?.bridge, "out");
  const value = known(routes);
  if (!asset)
    return (
      <AssetPicker
        assets={money.assets}
        other={[]}
        selectedKey={undefined}
        reasonFor={(a) => (!a.bridge ? "No bridge for this token" : spendableOf(a) === 0n ? "None to send" : undefined)}
        detailFor={(a) => `Available ${amountOf(a, spendableOf(a))}`}
        onPick={setAsset}
      />
    );
  if (!chain)
    return value ? (
      value.chains.length === 0 ? (
        <QuietLine action={{ label: "Pick another", onClick: () => setAsset(undefined) }}>
          No route for {asset.symbol}
        </QuietLine>
      ) : (
        <div className="grid gap-2">
          <p className="text-meta text-text-2">{asset.symbol} to</p>
          <ChainGrid routes={value} selected={undefined} onPick={setChain} />
        </div>
      )
    ) : routes.status === "failed" ? (
      <QuietLine>Couldn’t load the routes</QuietLine>
    ) : (
      <RowsSkeleton />
    );
  return <Route me={me} asset={asset} chain={chain} />;
}
